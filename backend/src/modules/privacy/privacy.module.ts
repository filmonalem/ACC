import { Module } from '@nestjs/common';
import {
  AdminPrivacyRequestsController,
  PrivacyRequestsController,
} from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  controllers: [PrivacyRequestsController, AdminPrivacyRequestsController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
