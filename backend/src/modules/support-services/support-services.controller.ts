import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { SupportServicesService } from './support-services.service';
import {
  CurrentUser,
  Public,
  RequirePermissions,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import {
  SUPPORT_SERVICES_MANAGE,
  SUPPORT_SERVICES_PUBLISH,
  SUPPORT_SERVICES_VERIFY,
  SUPPORT_SERVICES_MANAGE as VIEW_STAFF_SUPPORT,
} from '../../common/permissions';
import type { SupportServiceCategory } from '../../generated/prisma/enums';

/**
 * Declared above the DTOs and controllers on purpose. `@IsEnum(CATEGORIES)`
 * evaluates at class-definition time, so a `const` further down the file would
 * still be in its temporal dead zone and importing this module would throw.
 */
const CATEGORIES: SupportServiceCategory[] = [
  'COMMUNITY_ASSISTANCE',
  'HEALTH',
  'SOCIAL_SUPPORT',
  'DISABILITY_SUPPORT',
  'PUBLIC_INFORMATION',
];

class CreateSupportServiceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(20, { message: 'Describe the service so residents can recognise it.' })
  @MaxLength(4000)
  description!: string;

  @IsEnum(CATEGORIES)
  category!: SupportServiceCategory;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  serviceArea!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  eligibility!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  websiteUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hoursNotes!: string;

  @IsOptional()
  @IsUUID()
  organizationId!: string;
}

class VerifySupportServiceDto {
  @IsEnum(['PENDING', 'VERIFIED', 'EXPIRED', 'WITHDRAWN'])
  status!: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'WITHDRAWN';

  @IsOptional()
  @IsString()
  expiresAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note!: string;
}

@ApiTags('Community support')
@Controller('support-services')
export class SupportServicesController {
  constructor(private readonly services: SupportServicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Verified, published community support listings' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'ti', 'am'] })
  @ApiQuery({ name: 'category', required: false, enum: CATEGORIES })
  list(
    @Query('locale') locale: string | undefined,
    @Query('category') category: SupportServiceCategory | undefined,
    @Query('search') search?: string,
  ) {
    return this.services.listPublished(locale ?? 'en', category, search);
  }
}

@ApiTags('Community support (staff)')
@Controller('admin/support-services')
@RequirePermissions(VIEW_STAFF_SUPPORT)
export class AdminSupportServicesController {
  constructor(private readonly services: SupportServicesService) {}

  @Get()
  @ApiOperation({ summary: 'All listings, including unverified ones' })
  list() {
    return this.services.listForStaff();
  }

  @Post()
  @RequirePermissions(SUPPORT_SERVICES_MANAGE)
  @ApiOperation({ summary: 'Create a listing (starts unverified and unpublished)' })
  create(
    @Body() dto: CreateSupportServiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.services.create(dto, user, this.meta(request));
  }

  @Put(':id/verification')
  @RequirePermissions(SUPPORT_SERVICES_VERIFY)
  @ApiOperation({ summary: 'Record a verification decision' })
  verify(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VerifySupportServiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.services.verify(id, dto, user, this.meta(request));
  }

  @Post(':id/publish')
  @RequirePermissions(SUPPORT_SERVICES_PUBLISH)
  @ApiOperation({ summary: 'Publish a verified listing' })
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.services.publish(id, user, this.meta(request));
  }

  private meta(request: Request) {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }
}



