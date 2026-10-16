import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { UsersService } from './users.service';
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import {
  ORGANIZATIONS_APPROVE,
  ORGANIZATIONS_MANAGE,
  ROLES_ASSIGN,
  ROLES_MANAGE,
  USERS_MANAGE,
  USERS_VIEW,
} from '../../common/permissions';
import type { RoleKey } from '../../generated/prisma/enums';

/**
 * Declared above the DTOs and controllers on purpose. `@IsEnum(ROLE_KEYS)`
 * evaluates at class-definition time, so a `const` further down the file would
 * still be in its temporal dead zone and importing this module would throw.
 */
const ROLE_KEYS: RoleKey[] = [
  'RESIDENT',
  'TRIAGE_OFFICER',
  'SERVICE_OFFICER',
  'CONTENT_EDITOR',
  'SUPERVISOR',
  'SYSTEM_ADMIN',
];

class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsEnum(['en', 'ti', 'am'])
  preferredLocale!: 'en' | 'ti' | 'am';

  @IsEnum(ROLE_KEYS, { each: true })
  roleKeys!: RoleKey[];

  @IsOptional()
  @IsUUID()
  organizationId!: string;
}

class SetStatusDto {
  @IsEnum(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';

  @IsString()
  @MinLength(5, { message: 'Give a reason so the change can be understood later.' })
  @MaxLength(1000)
  reason!: string;
}

class SetRoleDto {
  @IsEnum(ROLE_KEYS)
  roleKey!: RoleKey;

  @IsBoolean()
  grant!: boolean;

  @IsOptional()
  @IsUUID()
  organizationId!: string;
}

class ApprovalDto {
  @IsBoolean()
  approve!: boolean;
}

@ApiTags('Staff administration')
@Controller('admin')
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermissions(USERS_VIEW)
  @ApiOperation({
    summary: 'Staff accounts',
    description:
      'Never includes password hashes, MFA secrets or session data, by ' +
      'construction rather than by filtering.',
  })
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.users.list(actor);
  }

  @Post('users')
  @RequirePermissions(USERS_MANAGE, ROLES_ASSIGN)
  @ApiOperation({ summary: 'Create a staff account (starts pending invite)' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.create(dto, actor, this.meta(request));
  }

  @Patch('users/:id/status')
  @RequirePermissions(USERS_MANAGE)
  @ApiOperation({
    summary: 'Enable or disable an account',
    description:
      'Disabling revokes every active session immediately. You cannot change ' +
      'the status of your own account.',
  })
  async setStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.setStatus(id, dto.status, dto.reason, actor, this.meta(request));
  }

  @Post('users/:id/roles')
  @RequirePermissions(ROLES_ASSIGN)
  @ApiOperation({
    summary: 'Grant or revoke a role',
    description:
      'Changing a role revokes that user\'s sessions so the change takes effect ' +
      'immediately rather than at token expiry.',
  })
  async setRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.setRole(
      id,
      dto.roleKey,
      dto.grant,
      dto.organizationId,
      actor,
      this.meta(request),
    );
  }

  @Get('roles')
  @RequirePermissions(USERS_VIEW)
  @ApiOperation({ summary: 'Roles and their permission sets' })
  roles() {
    return this.users.listRoles();
  }

  @Get('organizations')
  @RequirePermissions(ORGANIZATIONS_MANAGE, USERS_VIEW)
  @ApiOperation({ summary: 'Organizations' })
  organizations() {
    return this.users.listOrganizations();
  }

  @Post('organizations/:id/approval')
  @RequirePermissions(ORGANIZATIONS_APPROVE)
  @ApiOperation({
    summary: 'Approve or withdraw approval of an organization',
    description:
      'An unapproved organization cannot have contacts, announcements or ' +
      'support listings published on its behalf. This permission is separate ' +
      'from organizations.manage on purpose.',
  })
  async approveOrganization(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApprovalDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.approveOrganization(id, dto.approve, actor, this.meta(request));
  }

  private meta(request: Request) {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }
}

export { ROLES_MANAGE };
