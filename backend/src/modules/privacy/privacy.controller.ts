import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { PrivacyService } from './privacy.service';
import {
  CurrentUser,
  Public,
  RequirePermissions,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import { PRIVACY_MANAGE } from '../../common/permissions';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { PrivacyRequestStatus, PrivacyRequestType } from '../../generated/prisma/enums';

class CreatePrivacyRequestDto {
  @ApiProperty({
    enum: ['ACCESS', 'CORRECTION', 'DELETION', 'OBJECTION', 'RESTRICTION'],
  })
  @IsEnum(['ACCESS', 'CORRECTION', 'DELETION', 'OBJECTION', 'RESTRICTION'])
  requestType!: PrivacyRequestType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requesterName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  requesterEmail!: string;

  @IsOptional()
  @Matches(/^(\+?251)?0?9\d{8}$/, { message: 'Enter a valid Ethiopian mobile number.' })
  requesterPhone!: string;

  @IsString()
  @MinLength(20, { message: 'Please describe your request in a little more detail.' })
  @MaxLength(4000)
  details!: string;

  @IsOptional()
  @Matches(/^ACC-[0-9A-HJKMNP-TV-Z]{8}$/, {
    message: 'Enter the reference code exactly as given.',
  })
  reportReferenceCode!: string;
}

class PrivacyRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(['RECEIVED', 'IDENTITY_VERIFIED', 'IN_PROGRESS', 'FULFILLED', 'REJECTED'])
  status!: PrivacyRequestStatus;
}

class VerifyIdentityDto {
  @Transform(({ value }) => value === true)
  @IsBoolean()
  verified!: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  method!: string;
}

class RestrictionDto {
  @Transform(({ value }) => value === true)
  @IsBoolean()
  restrict!: boolean;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}

class CompleteRequestDto {
  @IsEnum(['FULFILLED', 'REJECTED'])
  status!: 'FULFILLED' | 'REJECTED';

  @IsString()
  @MinLength(10, { message: 'Record what was done, so the decision is defensible.' })
  @MaxLength(4000)
  resolutionNote!: string;
}

/**
 * Public submission of a personal data request.
 *
 * Separate from the staff routes because this is one of the few endpoints that
 * must work without a session: a resident exercising a data-protection right
 * cannot be required to hold an ACC account to ask for one.
 */
@ApiTags('Privacy requests (public)')
@Controller('privacy-requests')
export class PrivacyRequestsController {
  constructor(private readonly privacy: PrivacyService) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Submit an access, correction or deletion request',
    description:
      'No account required. You will need to provide identification separately ' +
      'before any request is acted on.',
  })
  submit(@Body() dto: CreatePrivacyRequestDto) {
    return this.privacy.submit(dto);
  }
}

/**
 * Staff handling of personal data requests.
 *
 * Every route requires `privacy.manage` and every action is audited, because
 * acting on one of these changes or destroys someone's personal data.
 */
@ApiTags('Privacy requests (staff)')
@Controller('admin/privacy-requests')
@RequirePermissions(PRIVACY_MANAGE)
export class AdminPrivacyRequestsController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  @ApiOperation({ summary: 'All privacy requests' })
  list(@Query() query: PrivacyRequestQueryDto) {
    return this.privacy.list(query);
  }

  @Post(':id/identity')
  @ApiOperation({ summary: 'Record an identity verification decision' })
  verifyIdentity(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VerifyIdentityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.privacy.verifyIdentity(id, dto.verified, dto.method, actor, this.meta(request));
  }

  @Post(':id/restriction')
  @ApiOperation({
    summary: 'Place or release a legal hold on the related report',
    description: 'A held report is skipped by the retention purge job.',
  })
  restrict(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RestrictionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.privacy.setRestriction(id, dto.restrict, dto.reason, actor, this.meta(request));
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Complete or reject a request',
    description: 'Fulfilment is refused unless identity has been verified.',
  })
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.privacy.complete(
      id,
      dto.status,
      dto.resolutionNote,
      actor,
      this.meta(request),
    );
  }

  private meta(request: Request) {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }
}