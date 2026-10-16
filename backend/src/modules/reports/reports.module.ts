import { Module } from '@nestjs/common';
import { PublicReportsController, AdminReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportCategoriesModule } from '../report-categories/report-categories.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ReportCategoriesModule, AttachmentsModule, NotificationsModule],
  controllers: [PublicReportsController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
