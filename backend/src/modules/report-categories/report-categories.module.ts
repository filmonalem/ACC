import { Module } from '@nestjs/common';
import {
  ReportCategoriesController,
  ReportCategoriesService,
} from './report-categories.service';

@Module({
  controllers: [ReportCategoriesController],
  providers: [ReportCategoriesService],
  exports: [ReportCategoriesService],
})
export class ReportCategoriesModule {}
