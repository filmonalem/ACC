import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { REPORTS_VIEW_ATTACHMENTS } from '../../common/permissions';

/**
 * Staff attachment downloads.
 *
 * Note there is no public counterpart. A resident's attachment is never
 * reachable by a URL alone — not even by the resident who uploaded it. Files
 * arrive through the report submission flow and are reviewed by staff; serving
 * them back on a guessable path would publish resident photographs.
 */
@ApiTags('Attachments')
@Controller('admin/reports/:reportId/attachments')
@RequirePermissions(REPORTS_VIEW_ATTACHMENTS)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(':attachmentId')
  @ApiOperation({
    summary: 'Download a file attached to a report',
    description:
      'Authorization is re-checked on every request. Report access, the ' +
      'attachment permission, and the malware-scan verdict must all pass.',
  })
  async download(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.attachments.downloadForStaff(
      reportId,
      attachmentId,
      user,
      response.getHeader('x-request-id')?.toString() ?? null,
    );

    // `attachment` disposition with a sanitised filename: the browser saves the
    // file rather than rendering it, which matters for an HTML or SVG payload
    // that slipped past the type allowlist.
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.asciiFileName(result.originalName)}"`,
    );
    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Length', result.byteSize);
    // Defence in depth against a stored-XSS payload rendered in the same origin.
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.setHeader('Cache-Control', 'no-store, private');

    return new StreamableFile(result.stream);
  }

  /** Non-ASCII names are transliterated; a fallback is always supplied. */
  private asciiFileName(name: string): string {
    const ascii = name
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/["\\]/g, '')
      .trim();

    return ascii.length > 0 ? ascii.slice(0, 200) : 'attachment';
  }
}
