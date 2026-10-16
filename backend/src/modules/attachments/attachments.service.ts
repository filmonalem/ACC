import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain.errors';
import { assertCanReadReport } from '../../common/authorization/policy';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuditService } from '../../common/audit/audit.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Env } from '../../config/env.schema';

export interface UploadedAttachmentInput {
  originalName: string;
  contentType: string;
  buffer: Buffer;
}

/**
 * Report attachments.
 *
 * The storage path is private: files are written to a volume that no static
 * middleware serves, and bytes leave only through `download()`, which
 * re-checks authorization on every single request. There is no signed-URL
 * shortcut, because a signed URL is a bearer token that outlives a permission
 * change and is trivially forwarded.
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  /**
   * Validates an upload before anything touches the disk.
   *
   * Validation is by declared content type and by magic-number sniffing, in that
   * order, and they must agree. Relying on the client-supplied `Content-Type`
   * alone is how arbitrary executables end up on a server.
   */
  async assertUploadAcceptable(file: UploadedAttachmentInput): Promise<void> {
    if (file.buffer.byteLength === 0) {
      throw new BadRequestError('That file is empty.', 'empty_file');
    }

    if (file.buffer.byteLength > this.env.MAX_ATTACHMENT_BYTES) {
      throw new BadRequestError(
        `Files must be ${Math.round(this.env.MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB or smaller.`,
        'file_too_large',
      );
    }

    const allowed = this.env.ALLOWED_ATTACHMENT_TYPES;
    if (allowed.length === 0 || !allowed.includes(file.contentType)) {
      throw new BadRequestError(
        'That file type is not accepted. Please upload a JPEG, PNG, WebP image or a PDF.',
        'unsupported_file_type',
      );
    }

    if (!this.contentTypeMatchesBytes(file)) {
      // The declared type and the actual bytes disagree. That is either a
      // broken client or an attempt to smuggle something past the allowlist.
      throw new BadRequestError(
        'That file does not appear to be the type it claims to be, so it was not uploaded.',
        'file_type_mismatch',
      );
    }

    if (this.containsEmbeddedScript(file.contentType, file.buffer)) {
      throw new BadRequestError(
        'That file type can carry active content and is not accepted.',
        'unsafe_file_type',
      );
    }
  }

  async attachToReport(reportId: string, files: UploadedAttachmentInput[]): Promise<void> {
    for (const file of files) {
      await this.assertUploadAcceptable(file);

      const stored = await this.storage.put({
        scope: 'reports',
        ownerId: reportId,
        content: file.buffer,
      });

      await this.prisma.reportAttachment.create({
        data: {
          reportId,
          objectKey: stored.objectKey,
          // The client's filename is preserved for display but sanitised: it is
          // echoed back in a Content-Disposition header, where an unescaped
          // quote or newline would be a header-injection vector.
          originalName: this.sanitiseFileName(file.originalName),
          contentType: file.contentType,
          byteSize: stored.byteSize,
          checksumSha256: stored.checksumSha256,
          scanStatus: this.env.SKIP_MALWARE_SCAN ? 'SKIPPED_DEV' : 'PENDING',
          scannedAt: this.env.SKIP_MALWARE_SCAN ? new Date() : null,
        },
      });
    }
  }

  /**
   * Streams an attachment to an authorized staff member.
   *
   * Three checks, in order: the caller can read *this* report, the caller holds
   * the attachment permission, and the file has not been flagged by scanning.
   * The third is why a `PENDING` file is not downloadable — serving unscanned
   * content to the person reviewing a report would move the risk, not remove it.
   */
  async downloadForStaff(
    reportId: string,
    attachmentId: string,
    user: AuthenticatedUser,
    requestId: string | null,
  ) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, deletedAt: null },
      include: { assignments: { where: { active: true } } },
    });

    if (!report) throw new NotFoundError('Report', 'report_not_found');

    assertCanReadReport(user.permissions, report.assignments[0]?.assigneeId === user.id);

    if (!user.permissions.includes('reports.view_attachments')) {
      throw new ForbiddenError(
        'You do not have permission to download files attached to reports.',
        'missing_permission',
      );
    }

    const attachment = await this.prisma.reportAttachment.findFirst({
      where: { id: attachmentId, reportId, deletedAt: null },
    });

    if (!attachment) throw new NotFoundError('Attachment', 'attachment_not_found');

    if (attachment.scanStatus === 'INFECTED') {
      throw new ForbiddenError(
        'This file was blocked by the malware scan and cannot be downloaded.',
        'attachment_blocked',
      );
    }

    if (attachment.scanStatus === 'PENDING') {
      throw new ForbiddenError(
        'This file is still being scanned and cannot be downloaded yet.',
        'attachment_pending_scan',
      );
    }

    if (!(await this.storage.exists(attachment.objectKey))) {
      this.logger.error(
        `Attachment ${attachment.id} is recorded in the database but missing from storage`,
      );
      throw new NotFoundError('Attachment file', 'attachment_file_missing');
    }

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'reports.attachment.downloaded',
      entityType: 'report',
      entityId: report.id,
      metadata: {
        attachmentId: attachment.id,
        referenceCode: report.referenceCode,
        contentType: attachment.contentType,
        byteSize: attachment.byteSize,
      },
      requestId,
    });

    return {
      stream: this.storage.openStream(attachment.objectKey),
      contentType: attachment.contentType,
      byteSize: attachment.byteSize,
      originalName: attachment.originalName,
      checksumSha256: attachment.checksumSha256,
    };
  }

  // ── file inspection ───────────────────────────────────────────────────────

  private contentTypeMatchesBytes(file: UploadedAttachmentInput): boolean {
    const { buffer, contentType } = file;

    const startsWith = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);

    if (contentType === 'image/jpeg') return startsWith(0xff, 0xd8, 0xff);
    if (contentType === 'image/png') return startsWith(0x89, 0x50, 0x4e, 0x47);
    if (contentType === 'image/webp') {
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    if (contentType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';

    return false;
  }

  /**
   * A conservative executable check.
   *
   * With an allowlist of four inert types this is belt-and-braces rather than the
   * primary control, but PDFs are a documented malware vector and an
   * allowlisted upload should still not be able to be an executable.
   */
  private containsEmbeddedScript(contentType: string, buffer: Buffer): boolean {
    if (contentType !== 'application/pdf') return false;

    const head = buffer.subarray(0, Math.min(buffer.byteLength, 8192)).toString('latin1');

    return (
      /\/JavaScript\s*\(/.test(head) ||
      /\/JS\s*\(/.test(head) ||
      /\/Launch\s*\(/.test(head) ||
      /\/EmbeddedFile/.test(head)
    );
  }

  /**
   * Reduces a client filename to something safe to echo in a header and to store.
   *
   * Path components are discarded entirely rather than stripped character by
   * character, and quotes, CR and LF are removed — a filename is display data
   * only, so there is nothing to lose by being aggressive.
   */
  private sanitiseFileName(name: string): string {
    const base = name.split(/[/\\]/).pop() ?? 'file';
    const cleaned = base.replace(/["'\r\n\x00]/g, '').trim();

    return (cleaned.length > 0 ? cleaned : 'file').slice(0, 255);
  }
}
