import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { Env } from '../../config/env.schema';

/**
 * Transactional outbox.
 *
 * Notification rows are written *inside* the same transaction as the event that
 * caused them, then delivered by a worker. If the two were separate operations,
 * either a committed change could lose its notification or a failed notification
 * could roll back a legitimate status change.
 *
 * **No provider is wired in the pilot.** `ENABLE_NOTIFICATION_WORKER` defaults to
 * false and no SMS or email credentials exist. Rows therefore stay `QUEUED`
 * forever, and the interface states plainly that nothing was sent. That is
 * deliberate: a platform that silently swallows an escalation because a vendor
 * account lapsed would be worse than one that visibly has no SMS integration.
 *
 * The recipient is *not* stored on the row — only a template key and the report
 * or user id. The worker resolves the address at send time from the referenced
 * record, so the outbox table never becomes a list of resident phone numbers
 * that could leak independently of the report it belongs to.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  /** Confirmation that a report was received. */
  async queueReportReceived(
    reportId: string,
    referenceCode: string,
    locale: string,
  ): Promise<void> {
    await this.enqueue({
      reportId,
      locale,
      channel: NotificationChannel.SMS,
      template: 'report.received',
      dedupeKey: `report.received:${reportId}`,
      payload: { referenceCode },
    });
  }

  /** Internal notice that a report was assigned. Goes to staff, not residents. */
  async queueAssignment(
    reportId: string,
    assigneeId: string,
    referenceCode: string,
    locale: string,
  ): Promise<void> {
    await this.enqueue({
      reportId,
      userId: assigneeId,
      locale,
      channel: NotificationChannel.IN_APP,
      template: 'report.assigned',
      dedupeKey: `report.assigned:${reportId}:${assigneeId}`,
      payload: { referenceCode },
    });
  }

  /**
   * Internal escalation notice for designated review personnel.
   *
   * The template text is explicit that this does not contact any emergency
   * service. There is no integration to contact one, and a message implying
   * otherwise would be the single most damaging thing this system could send.
   */
  async queueEscalation(
    reportId: string,
    referenceCode: string,
    reason: string,
    locale: string,
  ): Promise<void> {
    await this.enqueue({
      reportId,
      locale,
      channel: NotificationChannel.IN_APP,
      template: 'report.escalated.internal_only',
      dedupeKey: `report.escalated:${reportId}`,
      payload: { referenceCode, reason, dispatchContacted: false },
    });
  }

  /** Staff-facing review request. */
  async queueTriageRequest(reportId: string, referenceCode: string, locale: string): Promise<void> {
    await this.enqueue({
      reportId,
      locale,
      channel: NotificationChannel.IN_APP,
      template: 'report.triage_requested',
      dedupeKey: `report.triage_requested:${reportId}`,
      payload: { referenceCode },
    });
  }

  private async enqueue(params: {
    reportId?: string;
    userId?: string;
    locale: string;
    channel: NotificationChannel;
    template: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          reportId: params.reportId ?? null,
          userId: params.userId ?? null,
          locale: params.locale,
          channel: params.channel,
          template: params.template,
          payload: params.payload as never,
          dedupeKey: params.dedupeKey,
          status: 'QUEUED',
        },
      });
    } catch (error) {
      // A duplicate dedupeKey (a retried request) is expected and harmless.
      // Anything else is logged but never blocks the originating action: a
      // resident's report must not be rejected because a notification row
      // failed to insert.
      this.logger.warn(
        `Could not queue notification "${params.template}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Counts of undelivered notifications.
   *
   * Surfaced on the dashboard so an operator can see that escalation notices are
   * piling up unsent rather than assuming they went out.
   */
  async pendingCounts(): Promise<{ queued: number; failed: number }> {
    const [queued, failed] = await Promise.all([
      this.prisma.notification.count({ where: { status: 'QUEUED' } }),
      this.prisma.notification.count({ where: { status: 'FAILED' } }),
    ]);
    return { queued, failed };
  }

  get deliveryEnabled(): boolean {
    return this.env.ENABLE_NOTIFICATION_WORKER;
  }
}
