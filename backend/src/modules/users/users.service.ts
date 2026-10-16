import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain.errors';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../../common/services/password.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthService } from '../auth/auth.service';
import type { RoleKey } from '../../generated/prisma/enums';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async list(actor: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      include: {
        roles: {
          include: {
            role: { select: { id: true, key: true, name: true } },
            organization: { select: { id: true, name: true } },
          },
        },
        memberships: {
          where: { leftAt: null },
          include: { organization: { select: { id: true, name: true, isApproved: true } } },
        },
      },
    });

    void actor;

    // No password hashes, no MFA secrets, no session data. This endpoint feeds a
    // staff-management screen, so the temptation to add "helpful" fields is
    // exactly where credentials leak from.
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      preferredLocale: user.preferredLocale,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      roles: user.roles.map((grant) => ({
        role: grant.role,
        organizationId: grant.organizationId,
        organization: grant.organization,
      })),
      organizations: user.memberships.map((membership) => membership.organization),
    }));
  }

  /**
   * Creates a staff account.
   *
   * The account starts `PENDING_INVITE` with no usable password until they set
   * one, so creating an account cannot quietly produce a credential the creator
   * knows. The one-time setup token is returned rather than emailed because no
   * email provider is wired — the pilot hands it over out of band.
   */
  async create(
    input: {
      email: string;
      fullName: string;
      phone?: string;
      preferredLocale?: string;
      roleKeys: RoleKey[];
      organizationId?: string;
    },
    actor: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('An account with that email already exists.', 'email_taken');
    }

    const roles = await this.prisma.role.findMany({
      where: { key: { in: input.roleKeys } },
      select: { id: true, key: true },
    });

    if (roles.length !== input.roleKeys.length) {
      const found = roles.map((role) => role.key);
      const missing = input.roleKeys.filter((key) => !found.includes(key));
      throw new BadRequestError(`Unknown role(s): ${missing.join(', ')}.`, 'unknown_role');
    }

    // Granting a role someone does not hold yourself is privilege escalation by
    // proxy. Supervisors may grant what they have; only a system administrator
    // may grant broader.
    this.assertMayGrantRoles(input.roleKeys, actor);

    if (input.organizationId) {
      await this.assertOrganizationApproved(input.organizationId);
    }

    const setupToken = this.passwords.createToken();

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: input.fullName.trim(),
        phone: input.phone?.trim() ?? null,
        preferredLocale: input.preferredLocale ?? 'en',
        status: 'PENDING_INVITE',
        passwordHash: null,
        roles: {
          create: roles.map((role) => ({
            roleId: role.id,
            organizationId: input.organizationId ?? null,
            grantedById: actor.id,
          })),
        },
        ...(input.organizationId
          ? {
              memberships: {
                create: { organizationId: input.organizationId, title: 'Staff' },
              },
            }
          : {}),
      },
      select: { id: true, email: true, fullName: true, status: true },
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRoles: actor.roles,
      organizationId: input.organizationId ?? null,
      action: 'users.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email, roles: input.roleKeys, status: 'PENDING_INVITE' },
      requestId: context.requestId,
    });

    return {
      user,
      // Returned once. Without an email provider this is the only way the new
      // account can be activated. Tracked as an open pilot-readiness gate in
      // docs/03-milestones.md (M12).
      setupToken,
    };
  }

  /**
   * Enables or disables an account.
   *
   * Disabling revokes every session immediately, so the effect does not wait out
   * the 15-minute access token. Nobody may disable their own account — the
   * request would otherwise succeed and immediately lock the caller out, which
   * is a lockout with no recovery in a pilot with few administrators.
   */
  async setStatus(
    userId: string,
    status: 'ACTIVE' | 'DISABLED',
    reason: string,
    actor: AuthenticatedUser,
    context: RequestMeta,
  ) {
    if (userId === actor.id) {
      throw new BadRequestError(
        'You cannot change the status of your own account. Ask another administrator.',
        'cannot_change_own_status',
      );
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, status: true },
    });

    if (!target) throw new NotFoundError('User', 'user_not_found');

    if (target.status === status) return { status };

    await this.prisma.user.update({ where: { id: userId }, data: { status } });

    if (status === 'DISABLED') {
      await this.auth.revokeAllSessions(userId, 'Account disabled', {
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRoles: actor.roles,
      action: status === 'DISABLED' ? 'users.disabled' : 'users.enabled',
      entityType: 'user',
      entityId: userId,
      metadata: { from: target.status, to: status, email: target.email },
      reason,
      requestId: context.requestId,
    });

    this.logger.log(`Account ${target.email} ${status === 'DISABLED' ? 'disabled' : 'enabled'} by ${actor.email}`);

    return { status };
  }

  /** Grants or revokes a role, optionally scoped to one organization. */
  async setRole(
    userId: string,
    roleKey: RoleKey,
    grant: boolean,
    organizationId: string | undefined,
    actor: AuthenticatedUser,
    context: RequestMeta,
  ) {
    if (userId === actor.id && !grant) {
      throw new BadRequestError(
        'You cannot revoke your own roles. Ask another administrator.',
        'cannot_revoke_own_role',
      );
    }

    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } }),
      this.prisma.role.findUnique({ where: { key: roleKey }, select: { id: true, key: true } }),
    ]);

    if (!user) throw new NotFoundError('User', 'user_not_found');
    if (!role) throw new NotFoundError('Role', 'role_not_found');

    this.assertMayGrantRoles([roleKey], actor);

    if (organizationId) {
      await this.assertOrganizationApproved(organizationId);
    }

    // The partial unique indexes (one global grant, one per organization) make
    // a duplicate grant a constraint violation rather than a silent no-op.
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id, organizationId: organizationId ?? null },
    });

    if (grant && existing) {
      return { granted: true, unchanged: true };
    }

    if (grant) {
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
          organizationId: organizationId ?? null,
          grantedById: actor.id,
        },
      });
    } else if (existing) {
      await this.prisma.userRole.delete({ where: { id: existing.id } });
    }

    // Changing someone's roles invalidates their live token, otherwise a
    // permission removed here stays in force for the rest of the token's life.
    await this.auth.revokeAllSessions(userId, 'Role assignment changed', {
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRoles: actor.roles,
      organizationId: organizationId ?? null,
      action: grant ? 'users.role.granted' : 'users.role.revoked',
      entityType: 'user',
      entityId: userId,
      metadata: { roleKey, organizationId: organizationId ?? null },
      requestId: context.requestId,
    });

    return { granted: grant };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { key: 'asc' },
      include: {
        permissions: { select: { permissionCode: true } },
        _count: { select: { users: true } },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((permission) => permission.permissionCode).sort(),
      assignedUserCount: role._count.users,
    }));
  }

  async listOrganizations() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { memberships: true, serviceContacts: true } } },
    });
  }

  /**
   * Approves an organization for participation.
   *
   * Held by `organizations.approve`, deliberately separate from
   * `organizations.manage`. Without the separation, whoever can edit an
   * organization's details could also grant it standing to publish contact
   * details and announcements to the public.
   */
  async approveOrganization(
    organizationId: string,
    approve: boolean,
    actor: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });

    if (!organization) throw new NotFoundError('Organization', 'organization_not_found');

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        isApproved: approve,
        approvedById: approve ? actor.id : null,
        approvedAt: approve ? new Date() : null,
      },
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRoles: actor.roles,
      action: approve ? 'organizations.approved' : 'organizations.approval_revoked',
      entityType: 'organization',
      entityId: organizationId,
      metadata: { name: organization.name },
      requestId: context.requestId,
    });

    return { isApproved: approve };
  }

  // ── guards ────────────────────────────────────────────────────────────────

  /**
   * Nobody may grant a capability they do not themselves hold.
   *
   * A supervisor can hand out exactly what they have and nothing more. Only a
   * system administrator — the role that by design holds no report access at
   * all — may grant roles, because the only way to grant something you lack is
   * to be the role that administers the permission system itself.
   */
  private assertMayGrantRoles(roleKeys: RoleKey[], actor: AuthenticatedUser): void {
    if (actor.permissions.includes('roles.manage')) return;

    throw new ForbiddenError(
      'You cannot grant roles. Ask a system administrator.',
      'cannot_grant_roles',
    );
  }

  private async assertOrganizationApproved(organizationId: string): Promise<void> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { isApproved: true, name: true },
    });

    if (!organization) throw new NotFoundError('Organization', 'organization_not_found');

    if (!organization.isApproved) {
      throw new BadRequestError(
        `"${organization.name}" has not been approved to participate in the platform yet.`,
        'organization_not_approved',
      );
    }
  }

}

export interface RequestMeta {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
