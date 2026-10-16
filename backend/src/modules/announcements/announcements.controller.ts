import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { Request } from 'express';
import { AnnouncementsService } from './announcements.service';
import {
  CurrentUser,
  Public,
  RequirePermissions,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import {
  ANNOUNCEMENTS_APPROVE,
  ANNOUNCEMENTS_ARCHIVE,
  ANNOUNCEMENTS_CREATE,
  ANNOUNCEMENTS_EDIT,
  ANNOUNCEMENTS_PUBLISH,
  ANNOUNCEMENTS_VIEW_DRAFT,
} from '../../common/permissions';
import { PageMetaDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AnnouncementCategory } from '../../generated/prisma/enums';

/**
 * Declared above the DTOs and controllers on purpose. `@IsEnum(CATEGORIES)`
 * evaluates at class-definition time, so a `const` further down the file would
 * still be in its temporal dead zone and importing this module would throw.
 */
const CATEGORIES: AnnouncementCategory[] = [
  'PUBLIC_SAFETY',
  'SERVICE_NOTICE',
  'HEALTH_ADVISORY',
  'INFRASTRUCTURE',
  'COMMUNITY',
  'OTHER',
];

class PublicAnnouncementsQuery extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(['en', 'ti', 'am'])
  locale!: 'en' | 'ti' | 'am';

  @IsOptional()
  @IsEnum(CATEGORIES)
  category!: AnnouncementCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search!: string;
}

class TranslationDto {
  @IsEnum(['en', 'ti', 'am'])
  locale!: 'en' | 'ti' | 'am';

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  summary!: string;

  @IsString()
  @MinLength(20, { message: 'The announcement body is too short to publish.' })
  @MaxLength(20000)
  body!: string;

  /**
   * Set by a human editor. Deliberately explicit rather than inferred: a
   * machine translation must not be able to mark itself reviewed.
   */
  @Transform(({ value }) => value === true)
  @IsBoolean()
  isHumanReviewed!: boolean;
}

class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  slug!: string;

  @IsEnum(CATEGORIES)
  category!: AnnouncementCategory;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceName!: string;

  @IsOptional()
  @IsUUID()
  organizationId!: string;

  @IsEnum(['en', 'ti', 'am'])
  defaultLocale!: 'en' | 'ti' | 'am';

  @IsOptional()
  @IsDateString()
  expiresAt!: string;

  @IsOptional()
  @Transform(({ value }) => value === true)
  @IsBoolean()
  isPinned!: boolean;

  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];
}

class UpdateContentDto {
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];
}

class ApproveDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note!: string;
}

class PublishDto {
  @IsOptional()
  @IsDateString()
  scheduledFor!: string;

  @IsOptional()
  @IsDateString()
  expiresAt!: string;
}

class ReasonDto {
  @IsString()
  @MinLength(5, { message: 'Give a reason so the change can be understood later.' })
  @MaxLength(1000)
  reason!: string;
}

@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Published announcements' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'ti', 'am'] })
  @ApiQuery({ name: 'category', required: false, enum: CATEGORIES })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(@Query() query: PublicAnnouncementsQuery) {
    const result = await this.announcements.listPublished({
      locale: query.locale ?? 'en',
      category: query.category,
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });

    return { data: result.data, meta: PageMetaDto.build(query.page, query.pageSize, result.total) };
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'A single published announcement',
    description:
      'Unpublished announcements are not reachable here at any status — the ' +
      'query requires PUBLISHED plus an unexpired publication date.',
  })
  get(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.announcements.getPublished(slug, locale ?? 'en');
  }
}

@ApiTags('Announcements (staff)')
@ApiResponse({ status: 403, description: 'Not permitted' })
@Controller('admin/announcements')
@RequirePermissions(ANNOUNCEMENTS_VIEW_DRAFT)
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'All announcements including drafts and unpublished ones' })
  list(@Query('locale') locale: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.listForStaff(locale ?? 'en', user);
  }

  @Post()
  @RequirePermissions(ANNOUNCEMENTS_CREATE)
  @ApiOperation({ summary: 'Create a draft announcement' })
  create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.announcements.create(dto, user, this.meta(request));
  }

  @Put(':id/content')
  @RequirePermissions(ANNOUNCEMENTS_EDIT)
  @ApiOperation({
    summary: 'Replace the translations of a draft',
    description: 'Any edit clears the human-reviewed flag on the changed translations.',
  })
  updateContent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.announcements.updateContent(id, dto.translations, user, this.meta(request));
  }

  @Post(':id/submit')
  @RequirePermissions(ANNOUNCEMENTS_EDIT)
  @ApiOperation({
    summary: 'Send a draft for review',
    description: 'Refused if any non-default translation is not marked human-reviewed.',
  })
  submitForReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.announcements.submitForReview(id, user, this.meta(request));
  }

  @Post(':id/approve')
  @RequirePermissions(ANNOUNCEMENTS_APPROVE)
  @ApiOperation({
    summary: 'Approve an announcement for publication',
    description: 'You cannot approve an announcement you wrote yourself.',
  })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.announcements.approve(id, user, { ...this.meta(request), note: dto.note });
  }

  @Post(':id/publish')
  @RequirePermissions(ANNOUNCEMENTS_PUBLISH)
  @ApiOperation({
    summary: 'Publish, or schedule the publication of, an approved announcement',
    description: 'Only an APPROVED announcement with an approval record can be published.',
  })
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.announcements.publish(id, user, { ...this.meta(request), ...dto });
  }

  @Post(':id/archive')
  @RequirePermissions(ANNOUNCEMENTS_ARCHIVE)
  @ApiOperation({ summary: 'Withdraw a published announcement' })
  archive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.announcements.archive(id, dto.reason, user, this.meta(request));
  }

  private meta(request: Request) {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }
}



