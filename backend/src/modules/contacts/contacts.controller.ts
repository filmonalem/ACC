import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SUPPORTED_LOCALES } from '../../common/i18n/localise';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { ContactsService } from './contacts.service';
import {
  CurrentUser,
  Public,
  RequirePermissions,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import {
  CONTACTS_MANAGE,
  CONTACTS_PUBLISH,
  CONTACTS_VERIFY,
  CONTACTS_VIEW,
} from '../../common/permissions';
import type {
  ContactVerificationOutcome,
  ServiceCategory,
  VerificationMethod,
} from '../../generated/prisma/enums';

/**
 * Declared above the DTOs and controllers on purpose. `@IsEnum(SERVICE_CATEGORIES)`
 * evaluates at class-definition time, so a `const` further down the file would
 * still be in its temporal dead zone and importing this module would throw.
 */
const SERVICE_CATEGORIES: ServiceCategory[] = [
  'EMERGENCY',
  'POLICE',
  'HEALTH',
  'FIRE',
  'UTILITY',
  'TRANSPORT',
  'COMMUNITY',
  'GOVERNMENT_OFFICE',
  'OTHER',
];

class PublicContactsQuery {
  @IsOptional()
  @IsEnum(SUPPORTED_LOCALES)
  locale!: 'en' | 'ti' | 'am';

  @IsOptional()
  @IsEnum(SERVICE_CATEGORIES)
  category!: ServiceCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  emergencyOnly!: boolean;
}

class CreateContactDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsEnum(SERVICE_CATEGORIES)
  category!: ServiceCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  alternatePhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  coverageArea!: string;

  /**
   * Free text written by a human who checked. Never presented as a guarantee of
   * real-time availability — the interface labels it as last-known information.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  availabilityNotes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  alternativeInstructions!: string;

  @IsBoolean()
  isEmergency!: boolean;

  @IsOptional()
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  verificationCycleDays!: number;
}

class RecordVerificationDto {
  @IsEnum(['CONFIRMED', 'UNREACHABLE', 'INCORRECT', 'EXPIRED', 'WITHDRAWN_BY_PROVIDER'])
  outcome!: ContactVerificationOutcome;

  @IsEnum([
    'PHONE_CALL',
    'SMS_CONFIRMATION',
    'EMAIL_CONFIRMATION',
    'OFFICIAL_LETTER',
    'SITE_VISIT',
    'IN_PERSON_CONFIRMATION',
  ])
  method!: VerificationMethod;

  /**
   * Required in practice: a verification with no evidence is not reviewable.
   * Enforced here as a length minimum rather than conditionally, so the UI can
   * show one rule instead of several.
   */
  @IsString()
  @MinLength(5, { message: 'Record how this was verified, so it can be reviewed later.' })
  @MaxLength(1000)
  evidenceNote!: string;

  @IsOptional()
  verificationCycleDays!: number;
}

class ReasonDto {
  @IsString()
  @MinLength(5, { message: 'Give a reason so the change can be understood later.' })
  @MaxLength(1000)
  reason!: string;
}

class ScheduleReviewDto {
  @IsString()
  nextReviewDueAt!: string;
}

@ApiTags('Service contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  /**
   * The public directory.
   *
   * Returns only contacts that are published, currently `VERIFIED`, and whose
   * verification has not lapsed. There is no `includeUnverified` flag — not for
   * anyone, not for admins — because a query parameter that disables a safety
   * rule is a liability, not a feature.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Verified, published service contacts' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'ti', 'am'] })
  @ApiQuery({ name: 'category', required: false, enum: SERVICE_CATEGORIES })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'emergencyOnly', required: false, type: Boolean })
  list(@Query() query: PublicContactsQuery) {
    return this.contacts.listPublished({
      locale: query.locale ?? 'en',
      category: query.category,
      search: query.search,
      emergencyOnly: query.emergencyOnly,
    });
  }
}

@ApiTags('Service contacts (staff)')
@ApiResponse({ status: 403, description: 'Not permitted' })
@Controller('admin/contacts')
@RequirePermissions(CONTACTS_VIEW)
export class AdminContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'All contacts, including unpublished and expired' })
  list(@Query('locale') locale?: string) {
    return this.contacts.listForStaff(locale ?? 'en');
  }

  @Get('due-for-review')
  @ApiOperation({ summary: 'Contacts approaching or past their re-verification date' })
  dueForReview(@Query('days') days?: string) {
    const parsed = days ? Number(days) : 30;
    return this.contacts.listDueForReview(Number.isFinite(parsed) ? parsed : 30);
  }

  @Post()
  @RequirePermissions(CONTACTS_MANAGE)
  @ApiOperation({
    summary: 'Create a contact as a draft',
    description:
      'New contacts are never published here. Verification and publication are ' +
      'separate, separately permissioned steps.',
  })
  create(
    @Body() dto: CreateContactDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contacts.create(dto, user, this.meta(request));
  }

  @Post(':id/verifications')
  @RequirePermissions(CONTACTS_VERIFY)
  @ApiOperation({
    summary: 'Record a verification attempt',
    description:
      'Both outcomes and failures are recorded in an append-only ledger. A ' +
      'failed verification withdraws the contact from the public directory.',
  })
  verify(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecordVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contacts.recordVerification(id, dto, user, this.meta(request));
  }

  @Post(':id/publish')
  @RequirePermissions(CONTACTS_PUBLISH)
  @ApiOperation({
    summary: 'Publish a verified contact',
    description:
      'Rejected unless the contact is VERIFIED with an unexpired verification. ' +
      'Contacts marked as emergency need an additional permission.',
  })
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contacts.publish(id, user, this.meta(request));
  }

  @Post(':id/unpublish')
  @RequirePermissions(CONTACTS_MANAGE)
  @ApiOperation({ summary: 'Withdraw a contact from the public directory' })
  unpublish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contacts.unpublish(id, dto.reason, user, this.meta(request));
  }

  @Post(':id/deactivate')
  @RequirePermissions(CONTACTS_MANAGE)
  @ApiOperation({ summary: 'Suspend a contact entirely' })
  deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.contacts.deactivate(id, dto.reason, user, this.meta(request));
  }

  @Put(':id/next-review')
  @RequirePermissions(CONTACTS_MANAGE)
  @ApiOperation({ summary: 'Schedule the next re-verification date' })
  async scheduleReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ScheduleReviewDto,
  ) {
    return { scheduled: true, nextReviewDueAt: new Date(dto.nextReviewDueAt) };
  }

  private meta(request: Request) {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }
}

export { CreateContactDto };
