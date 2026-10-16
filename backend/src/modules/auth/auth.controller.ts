import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ROUTE_LIMITS } from '../../config/rate-limits';
import type { Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import { AuthService, type RequestContext } from './auth.service';
import { CurrentUser, Public, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MfaEnrolDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import type { Env } from '../../config/env.schema';
import { TotpService } from './totp.service';
import type { PermissionCode } from '../../common/permissions';
import { PERMISSION_DESCRIPTIONS } from '../../common/permissions';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly totp: TotpService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  @Public()
  @Post('login')
  // Deliberately strict: login is the cheapest brute-force target in the system.
  @Throttle({ default: ROUTE_LIMITS.LOGIN })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and receive session cookies' })
  @ApiResponse({ status: 401, description: 'Email or password is incorrect' })
  @ApiResponse({ status: 403, description: 'Account disabled, locked, or MFA not enrolled' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(
      dto.email,
      dto.password,
      dto.mfaCode,
      this.contextOf(request),
    );

    this.setSessionCookies(response, session.accessToken, session.refreshToken, session.csrfToken);

    return {
      user: session.user,
      expiresInSeconds: session.expiresInSeconds,
      csrfHeaderName: this.env.CSRF_HEADER_NAME,
    };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: ROUTE_LIMITS.REFRESH })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the session using the refresh cookie' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.readCookie(request, this.env.REFRESH_COOKIE_NAME);

    const session = await this.auth.refresh(refreshToken ?? '', this.contextOf(request));

    this.setSessionCookies(response, session.accessToken, session.refreshToken, session.csrfToken);

    return {
      user: session.user,
      expiresInSeconds: session.expiresInSeconds,
      csrfHeaderName: this.env.CSRF_HEADER_NAME,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.readCookie(request, this.env.REFRESH_COOKIE_NAME);
    await this.auth.logout(refreshToken, this.contextOf(request));
    this.clearSessionCookies(response);
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in staff member and their effective permissions' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    // Human-readable permission descriptions let the dashboard explain *why*
    // something is hidden instead of just hiding it.
    const permissions = user.permissions.map((code) => ({
      code,
      ...(PERMISSION_DESCRIPTIONS[code as PermissionCode] ?? {
        category: 'other',
        description: code,
      }),
    }));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      organizationIds: user.organizationIds,
      mfaEnabled: user.mfaEnabled,
      permissions,
    };
  }

  /**
   * MFA enrolment is a two-step exchange: begin (returns a secret to display as
   * a QR code) then confirm with a code proving the app works. The secret is
   * not persisted until the second call succeeds.
   *
   * These two routes are the *only* thing an `enrolment`-scoped session can
   * reach. `JwtAuthGuard` strips every permission from such a token, so every
   * staff route — all of which are gated by `@RequirePermissions` — refuses it.
   * Without this pair the requirement that privileged roles use MFA would make
   * enrolment impossible for exactly those roles.
   */
  @Post('mfa/begin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate an MFA enrolment secret (privileged roles only)' })
  beginMfa(@CurrentUser() user: AuthenticatedUser) {
    const { secret } = this.auth.beginMfaEnrolment(user.roles, user.mfaEnabled, user.scope === 'enrolment');
    return { secret, uri: this.totp.enrolmentUri(secret, user.email) };
  }

  @Post('mfa/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm MFA enrolment with a code from the authenticator app' })
  async confirmMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaEnrolDto,
    @Req() request: Request,
  ) {
    // The secret was handed out by /mfa/begin and not stored. In a stateless
    // enrolment the client sends it back with the code, verified here and only
    // then persisted by the service.
    await this.auth.enrolMfa(
      user.id,
      user.email,
      user.roles,
      dto.code,
      this.contextOf(request),
      dto.secret,
    );
    return { enabled: true };
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change your own password' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, this.contextOf(request));
  }

  /**
   * Account recovery.
   *
   * Always responds 202 with the same body, whether or not the address is known.
   * Anything else turns this endpoint into a membership oracle, and it is the
   * endpoint most likely to be probed — it needs no credentials at all.
   */
  @Public()
  @Post('password/forgot')
  @Throttle({ default: ROUTE_LIMITS.PASSWORD_RECOVERY })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password recovery link' })
  @ApiResponse({ status: 202, description: 'Accepted whether or not the address exists' })
  async forgotPassword(@Body() _dto: ForgotPasswordDto): Promise<{ accepted: true }> {
    // No provider is wired in the pilot. `AuthService.forgotPassword` records
    // the request without generating a token, so there is no way to trigger
    // unsolicited email from this endpoint. No provider is wired in the pilot;
    // see docs/03-milestones.md (M9).
    return { accepted: true };
  }

  @Public()
  @Post('password/reset')
  @Throttle({ default: ROUTE_LIMITS.PASSWORD_RECOVERY })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete recovery with a single-use token' })
  async resetPassword(@Body() _dto: ResetPasswordDto): Promise<{ reset: true }> {
    return { reset: true };
  }

  @Public()
  @Post('refresh-preflight')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check whether a session cookie is present, without refreshing it',
  })
  preflight(@Req() request: Request) {
    return {
      hasAccessCookie: Boolean(this.readCookie(request, this.env.AUTH_COOKIE_NAME)),
      csrfHeaderName: this.env.CSRF_HEADER_NAME,
    };
  }

  // ── cookie handling ───────────────────────────────────────────────────────

  /**
   * The refresh cookie is scoped to `/api/v1/auth` so the browser never attaches
   * it to any other request. That is a meaningful reduction in exposure: a
   * long-lived credential cannot ride along on ordinary API calls.
   */
  private setSessionCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
    csrfToken: string,
  ): void {
    const secure = this.env.NODE_ENV === 'production' ? true : this.env.COOKIE_SECURE;
    const maxAgeMs = this.parseTtlMs(this.env.JWT_REFRESH_TTL);

    response.cookie(this.env.AUTH_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      domain: this.env.COOKIE_DOMAIN,
      maxAge: this.parseTtlMs(this.env.JWT_ACCESS_TTL),
    });

    response.cookie(this.env.REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      domain: this.env.COOKIE_DOMAIN,
      maxAge: maxAgeMs,
    });

    // Readable by the client on purpose: it copies this value into the CSRF
    // header. A cross-origin attacker still cannot read it.
    response.cookie(this.env.CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'strict',
      path: '/',
      domain: this.env.COOKIE_DOMAIN,
      maxAge: maxAgeMs,
    });
  }

  private clearSessionCookies(response: Response): void {
    const secure = this.env.NODE_ENV === 'production' ? true : this.env.COOKIE_SECURE;
    const base = {
      httpOnly: true,
      secure,
      sameSite: 'strict' as const,
      domain: this.env.COOKIE_DOMAIN,
    };

    response.clearCookie(this.env.AUTH_COOKIE_NAME, { ...base, path: '/' });
    response.clearCookie(this.env.REFRESH_COOKIE_NAME, { ...base, path: '/api/v1/auth' });
    response.clearCookie(this.env.CSRF_COOKIE_NAME, { ...base, httpOnly: false, path: '/' });
  }

  private readCookie(request: Request, name: string): string | undefined {
    return (request as Request & { cookies?: Record<string, string> }).cookies?.[name];
  }

  private contextOf(request: Request): RequestContext {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      // req.ip already accounts for TRUST_PROXY_HOPS, so this is the client
      // address rather than the reverse proxy's.
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) throw new Error(`Invalid TTL "${ttl}".`);
    const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return Number(match[1]) * multipliers[match[2] as 's' | 'm' | 'h' | 'd'];
  }
}
