import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from '../../common/errors/domain.errors';
import { assertAccountUsable, effectiveAccess, requiresMfa } from '../../common/authorization/policy';
import type { PermissionCode } from '../../common/permissions';
import type { RoleKey } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../../common/services/password.service';
import { CryptoService } from '../../common/services/crypto.service';
import { AuditService } from '../../common/audit/audit.service';
import { TotpService } from './totp.service';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.schema';

/**
 * A real Argon2id hash of a random password that was generated once and
 * discarded.
 *
 * Verifying against it keeps the "email does not exist" path the same cost as
 * the "wrong password" path. Without it, response time reveals which addresses
 * have accounts — and a placeholder that is not a *valid* hash would make
 * `argon2.verify` throw and return early, defeating the whole point.
 *
 * OWASP baseline parameters, matching the default configuration.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$SYcU1aJq+un1DQqMo1DtzA$8T8Dcox0IY1ahIAM+HWGdVMVyg9MiGTZPaZJ3I7io0M';

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  /** Seconds until the access token expires, for the client to schedule a refresh. */
  expiresInSeconds: number;
  user: SessionUser;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleKey[];
  permissions: PermissionCode[];
  organizationIds: string[];
  mfaEnabled: boolean;
  mfaRequired: boolean;
  scope: 'full' | 'enrolment';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly totp: TotpService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  // ── login ─────────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    mfaCode: string | undefined,
    context: RequestContext,
  ): Promise<IssuedSession> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: true } } } } },
    });

    if (!user) {
      await this.passwords.verifyPassword(DUMMY_HASH, password);
      await this.audit.denied({
        action: 'auth.login',
        entityType: 'user',
        entityId: 'unknown',
        actorEmail: email,
        reason: 'No account for this email address',
        ...context,
      });
      // One message for every failure mode. Anything more specific is an
      // account-existence oracle.
      throw new UnauthorizedError('Email or password is incorrect.', 'invalid_credentials');
    }

    const passwordOk = await this.passwords.verifyPassword(user.passwordHash, password);

    if (!passwordOk) {
      await this.recordFailedLogin(user.id, user.email, context);
      throw new UnauthorizedError('Email or password is incorrect.', 'invalid_credentials');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.audit.denied({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        reason: 'Account locked after repeated failed attempts',
        ...context,
      });
      throw new ForbiddenError(
        'This account is temporarily locked after too many failed attempts. Try again later.',
        'account_locked',
      );
    }

    if (user.status !== 'ACTIVE') {
      await this.audit.denied({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        reason: `Account status is ${user.status}`,
        ...context,
      });
      throw new ForbiddenError(
        'This account is not active. Please contact your administrator.',
        'account_not_active',
      );
    }

    const access = effectiveAccess({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((grant) => grant.role.key),
      grants: user.roles.map((grant) => ({
        roleKey: grant.role.key,
        organizationId: grant.organizationId,
        expiresAt: grant.expiresAt,
        permissions: grant.role.permissions.map((permission) => permission.permissionCode as PermissionCode),
      })),
      mfaEnabled: user.mfaEnabled,
    });

    const mfaRequired = requiresMfa(access.roles);

    /**
     * A privileged account with no MFA yet gets an *enrolment* session rather
     * than a refusal.
     *
     * Refusing here was a deadlock: `/auth/mfa/begin` and `/auth/mfa/confirm`
     * both require an authenticated session, so refusing to issue one made MFA
     * enrolment impossible for exactly the roles that require it. The fix is not
     * to weaken the requirement but to issue a session that carries no
     * permissions at all — it authenticates the person so they can set up their
     * second factor, and grants them nothing else. Every staff route is gated by
     * `@RequirePermissions`, so an empty permission set reaches none of them, and
     * `JwtAuthGuard` strips `perms` on the way in regardless of what the token
     * claims.
     *
     * Audited as a distinct outcome from a normal sign-in, because an enrolment
     * session is a weaker session and should be visible as one in the trail.
     */
    if (mfaRequired && !user.mfaEnabled) {
      const enrolment = await this.issueSession(
        user.id,
        user.email,
        user.fullName,
        { roles: [], permissions: [], organizationIds: [] },
        false,
        context,
        randomUUID(),
        'enrolment',
      );

      await this.audit.record({
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: access.roles,
        action: 'auth.login.mfa_enrolment_required',
        entityType: 'user',
        entityId: user.id,
        metadata: { scope: 'enrolment' },
        ...context,
      });

      return enrolment;
    }

    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new UnauthorizedError(
          'Enter the 6-digit code from your authenticator app.',
          'mfa_code_required',
        );
      }
      if (!this.totp.verify(user.mfaSecretEncrypted, mfaCode)) {
        await this.audit.denied({
          actorUserId: user.id,
          actorEmail: user.email,
          action: 'auth.login.mfa',
          entityType: 'user',
          entityId: user.id,
          reason: 'Invalid or expired one-time code',
          ...context,
        });
        throw new UnauthorizedError('That code is not valid.', 'mfa_code_invalid');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const session = await this.issueSession(user.id, user.email, user.fullName, access, user.mfaEnabled, context);

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: access.roles,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      metadata: { mfaUsed: user.mfaEnabled, roleCount: access.roles.length },
      ...context,
    });

    return session;
  }

  // ── refresh with rotation ─────────────────────────────────────────────────

  /**
   * Exchanges a refresh cookie for a new pair.
   *
   * Rotation with reuse detection: each refresh mints a new token and revokes
   * its predecessor. If a token that was already rotated is presented again,
   * that means it was captured, so the entire family is revoked and the user
   * must sign in again. This is the mechanism that makes a stolen refresh token
   * short-lived.
   */
  async refresh(refreshToken: string, context: RequestContext): Promise<IssuedSession> {
    if (!refreshToken) {
      throw new UnauthorizedError('Your session has expired. Please sign in again.', 'no_refresh_token');
    }

    const tokenHash = this.crypto.sha256(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { roles: { include: { role: { include: { permissions: true } } } } } } },
    });

    if (!stored) {
      throw new UnauthorizedError('Your session has expired. Please sign in again.', 'invalid_refresh_token');
    }

    if (stored.revokedAt) {
      // Reuse of a rotated token: assume compromise, drop the whole family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'Refresh token reuse detected' },
      });

      await this.audit.denied({
        actorUserId: stored.userId,
        actorEmail: stored.user.email,
        action: 'auth.refresh.reuse_detected',
        entityType: 'session',
        entityId: stored.familyId,
        reason: 'A previously rotated refresh token was presented again; family revoked',
        ...context,
      });

      throw new UnauthorizedError(
        'For your security this session has been ended. Please sign in again.',
        'session_compromised',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Your session has expired. Please sign in again.', 'refresh_token_expired');
    }

    const user = stored.user;

    // Disabled or wiped account → no new tokens, and the session is closed out.
    assertAccountUsable(user.status, user.sessionsInvalidatedAt, 0);

    const access = effectiveAccess({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((grant) => grant.role.key),
      grants: user.roles.map((grant) => ({
        roleKey: grant.role.key,
        organizationId: grant.organizationId,
        expiresAt: grant.expiresAt,
        permissions: grant.role.permissions.map((permission) => permission.permissionCode as PermissionCode),
      })),
      mfaEnabled: user.mfaEnabled,
    });

    const session = await this.issueSession(
      user.id,
      user.email,
      user.fullName,
      access,
      user.mfaEnabled,
      context,
      stored.familyId,
    );

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), revokedReason: 'Rotated', replacedById: null },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: access.roles,
      action: 'auth.refresh',
      entityType: 'session',
      entityId: stored.familyId,
      ...context,
    });

    return session;
  }

  // ── logout ────────────────────────────────────────────────────────────────

  async logout(refreshToken: string | undefined, context: RequestContext): Promise<void> {
    if (!refreshToken) return;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.crypto.sha256(refreshToken) },
    });

    if (!stored) return;

    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'Signed out' },
    });

    await this.audit.record({
      actorUserId: stored.userId,
      action: 'auth.logout',
      entityType: 'session',
      entityId: stored.familyId,
      ...context,
    });
  }

  /** Revokes every session for a user — used when disabling an account. */
  async revokeAllSessions(userId: string, reason: string, context: RequestContext): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { sessionsInvalidatedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      actorUserId: userId,
      action: 'auth.sessions.revoked_all',
      entityType: 'user',
      entityId: userId,
      reason,
      ...context,
    });
  }

  // ── MFA enrolment ─────────────────────────────────────────────────────────

  /**
   * Completes MFA enrolment.
   *
   * Takes a freshly generated secret plus a code from the authenticator app, and
   * only then persists the encrypted secret. If enrolment fails halfway the
   * account is left without MFA and with no unusable secret, rather than
   * locked out of its own account.
   */
  async enrolMfa(
    userId: string,
    email: string,
    roles: RoleKey[],
    code: string,
    context: RequestContext,
    /** The secret returned by `beginMfaEnrolment`, echoed back by the client. */
    submittedSecret: string,
  ): Promise<{ secret: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError();
    if (user.mfaEnabled) {
      throw new BadRequestError('MFA is already enabled.', 'mfa_already_enabled');
    }

    /**
     * The secret under test is the one the user was just shown, not a new one.
     *
     * `/mfa/begin` is stateless by design — it hands out a secret and keeps
     * nothing — so the client sends that same secret back with the code, and
     * this is where it is finally checked and stored. Generating a second secret
     * here would make the confirmation step impossible: the code in the user's
     * authenticator app would belong to a secret nobody has.
     */
    const secret = submittedSecret?.trim();

    if (!secret || !this.totp.verifySecret(secret, code)) {
      throw new BadRequestError(
        'That code is not valid. Check your authenticator app and try again.',
        'mfa_code_invalid',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaSecretEncrypted: this.totp.encrypt(secret) },
    });

    await this.audit.record({
      actorUserId: userId,
      actorEmail: email,
      actorRoles: roles,
      action: 'auth.mfa.enrolled',
      entityType: 'user',
      entityId: userId,
      ...context,
    });

    return { secret };
  }

  /**
   * Returns the enrolment secret so the client can render it as a QR code.
   *
   * The secret is *not* persisted here — `beginMfaEnrolment` is stateless. It is
   * stored only when a valid code proves the authenticator app works.
   */
  beginMfaEnrolment(
    roles: RoleKey[],
    alreadyEnabled: boolean,
    /**
     * True when the caller holds an enrolment-scoped session.
     *
     * Such a session is only ever minted for an account whose roles *do*
     * require MFA and which has not enrolled, and it arrives with an empty role
     * list precisely because it grants nothing. Without this flag the role check
     * below would reject every legitimate enrolment as "MFA is not required for
     * your role" — the deadlock this session type exists to break.
     */
    isEnrolmentSession = false,
  ): { secret: string } {
    if (alreadyEnabled) {
      throw new BadRequestError('MFA is already enabled on this account.', 'mfa_already_enabled');
    }
    if (!isEnrolmentSession && !requiresMfa(roles)) {
      throw new BadRequestError(
        'MFA is not required for your role.',
        'mfa_not_required_for_role',
      );
    }
    return { secret: this.totp.generateSecret() };
  }

  // ── password change ───────────────────────────────────────────────────────

  /**
   * Changes a password and revokes every other session.
   *
   * The current password is required even though the caller is already
   * authenticated: an unlocked browser session plus a stolen tab should not be
   * enough to take over an account permanently. Existing sessions are dropped
   * so a password change genuinely locks out anyone else holding a token.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError();

    const ok = await this.passwords.verifyPassword(user.passwordHash, currentPassword);
    if (!ok) {
      await this.audit.denied({
        actorUserId: userId,
        actorEmail: user.email,
        action: 'auth.password.change',
        entityType: 'user',
        entityId: userId,
        reason: 'Current password was incorrect',
        ...context,
      });
      throw new UnauthorizedError('Your current password is incorrect.', 'invalid_credentials');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestError(
        'Your new password must be different from your current one.',
        'password_reused',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hashPassword(newPassword),
        mustChangePassword: false,
        // Bumping this invalidates every outstanding access token immediately,
        // rather than waiting out their 15-minute lifetime.
        sessionsInvalidatedAt: new Date(),
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'Password changed' },
    });

    await this.audit.record({
      actorUserId: userId,
      actorEmail: user.email,
      action: 'auth.password.changed',
      entityType: 'user',
      entityId: userId,
      ...context,
    });
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async issueSession(
    userId: string,
    email: string,
    fullName: string,
    access: { roles: RoleKey[]; permissions: PermissionCode[]; organizationIds: string[] },
    mfaEnabled: boolean,
    context: RequestContext,
    familyId: string = randomUUID(),
    /**
     * `enrolment` mints a token that can only reach the MFA enrolment routes.
     * See the `login()` call site for why this exists.
     */
    scope: 'full' | 'enrolment' = 'full',
  ): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { sessionsInvalidatedAt: true },
    });

    const payload: AccessTokenPayload = {
      sub: userId,
      email,
      name: fullName,
      roles: access.roles,
      perms: access.permissions,
      orgs: access.organizationIds,
      mfa: mfaEnabled,
      scope,
      sid: familyId,
      siat: user?.sessionsInvalidatedAt?.getTime() ?? 0,
      typ: 'access',
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      // `expiresIn` is typed as a template-literal union in jsonwebtoken; the
      // value is validated by parseTtlMs below before it is ever used.
      expiresIn: this.parseTtlMs(this.env.JWT_ACCESS_TTL) / 1000,
    });

    const refreshToken = this.passwords.createToken();
    const expiresAt = new Date(Date.now() + this.parseTtlMs(this.env.JWT_REFRESH_TTL));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.crypto.sha256(refreshToken),
        familyId,
        expiresAt,
        userAgentHash: context.userAgent ? this.crypto.sha256(context.userAgent) : null,
        ipHash: context.ipAddress ? this.crypto.hashWithPepper(context.ipAddress) : null,
      },
    });

    return {
      accessToken,
      refreshToken,
      csrfToken: this.issueCsrfToken(),
      expiresInSeconds: Math.floor(this.parseTtlMs(this.env.JWT_ACCESS_TTL) / 1000),
      user: {
        id: userId,
        email,
        fullName,
        roles: access.roles,
        permissions: access.permissions,
        organizationIds: access.organizationIds,
        mfaEnabled,
        // For an enrolment session this must read `true` even though `roles` is
        // empty, or the dashboard would offer a menu the session cannot use.
        mfaRequired: scope === 'enrolment' || requiresMfa(access.roles),
        scope,
      },
    };
  }

  private issueCsrfToken(): string {
    return this.crypto.issueCsrfToken();
  }

  private async recordFailedLogin(
    userId: string,
    email: string,
    context: RequestContext,
  ): Promise<void> {
    const failed = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });

    const shouldLock = failed.failedLoginCount >= this.env.MAX_FAILED_LOGINS;

    if (shouldLock) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + this.env.LOCKOUT_MINUTES * 60_000) },
      });
    }

    await this.audit.denied({
      actorUserId: userId,
      actorEmail: email,
      action: 'auth.login',
      entityType: 'user',
      entityId: userId,
      reason: shouldLock
        ? `Failed login; account locked for ${this.env.LOCKOUT_MINUTES} minutes`
        : 'Failed login — incorrect password',
      ...context,
    });
  }

  /** Parses `15m` / `7d` / `30s` into milliseconds. */
  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) {
      throw new Error(`Invalid TTL "${ttl}". Expected a form like 15m, 24h or 7d.`);
    }
    const value = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * multipliers[unit];
  }
}

export interface RequestContext {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
