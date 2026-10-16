import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';

/**
 * Global, because authentication is a prerequisite for almost every module and
 * re-importing it everywhere would add noise without adding isolation.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      // No default secret. Every call site passes the validated secret from
      // `ACC_ENV`, so a forgotten signing option fails loudly instead of
      // silently signing with an empty key.
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TotpService],
  exports: [AuthService, TotpService, JwtModule],
})
export class AuthModule {}
