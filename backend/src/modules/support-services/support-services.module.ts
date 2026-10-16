import { Module } from '@nestjs/common';
import {
  AdminSupportServicesController,
  SupportServicesController,
} from './support-services.controller';
import { SupportServicesService } from './support-services.service';

@Module({
  controllers: [SupportServicesController, AdminSupportServicesController],
  providers: [SupportServicesService],
  exports: [SupportServicesService],
})
export class SupportServicesModule {}
