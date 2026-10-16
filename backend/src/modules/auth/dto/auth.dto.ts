import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Email is lowercased and trimmed before validation so `A@B.com` and `a@b.com`
 * cannot become two accounts. Length is capped to what an address can
 * plausibly be rather than to a database column width.
 */
const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

export class LoginDto {
  @ApiProperty({ example: 'triage.officer@acc.invalid' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'a-strong-passphrase' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({
    description:
      'Second factor code. Required when the account has MFA enabled and the ' +
      'first factor alone is insufficient.',
  })
  @IsOptional()
  @IsString()
  @Length(6, 10, { message: 'Enter the 6-digit code from your authenticator app.' })
  @Matches(/^[0-9]{6}$/, { message: 'Enter the 6-digit code from your authenticator app.' })
  mfaCode!: string;
}

export class RefreshDto {
  /**
   * Intentionally empty: the refresh token arrives in an httpOnly cookie scoped
   * to the auth routes. Requiring it in the body as well would add a second
   * copy of a long-lived secret to places it can leak — logs, proxies,
   * request history.
   */
  @ApiPropertyOptional({ description: 'No body is required; the cookie carries the token.' })
  @IsOptional()
  @IsString()
  reason!: string;
}

export class MfaEnrolDto {
  @ApiProperty({ description: 'TOTP code proving the authenticator app is working.' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Enter the 6-digit code from your authenticator app.' })
  code!: string;

  /**
   * The secret returned by `/auth/mfa/begin`.
   *
   * Required because that endpoint is stateless: it displays a secret and
   * stores nothing, so the confirmation step has to carry the secret back for
   * the code to be checked against. Without it there is nothing to verify the
   * code against and enrolment cannot complete.
   */
  @ApiProperty({ description: 'The enrolment secret returned by /auth/mfa/begin.' })
  @IsString()
  @MinLength(16, { message: 'Enrolment secret is missing or malformed.' })
  @MaxLength(128)
  secret!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12, {
    message: 'Your new password must be at least 12 characters.',
  })
  @MaxLength(200)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Single-use token from the recovery link.' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12, { message: 'Your new password must be at least 12 characters.' })
  @MaxLength(200)
  newPassword!: string;
}
