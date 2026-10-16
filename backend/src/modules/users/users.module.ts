import { Module } from '@nestjs/common';
import { UsersAdminController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthService is exported by the global AuthModule; the explicit import keeps
  // the dependency visible to a reader of this file rather than implied.
  imports: [AuthModule],
  controllers: [UsersAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
