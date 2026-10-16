import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';

/**
 * No controller in v0.1: notifications are never read through the API, and
 * exposing an endpoint that lists them would create another place resident
 * contact details could leak from.
 */
@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
