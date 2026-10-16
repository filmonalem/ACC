import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/auth.decorators';
import {
  localise,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../../common/i18n/localise';

/**
 * Report categories are configuration, not content: an administrator manages
 * them, residents and staff read them. They are cached by the frontend because
 * they change rarely and are needed on the first paint of the report form.
 */
@Injectable()
export class ReportCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(locale: SupportedLocale) {
    const categories = await this.prisma.reportCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: {
        key: true,
        labelI18n: true,
        descriptionI18n: true,
        icon: true,
        sortOrder: true,
        requiresUrgentReview: true,
      },
    });

    return {
      // Echoed back so the interface can say "shown in English" rather than
      // silently substituting a language the reader did not ask for.
      locale,
      data: categories.map((category) => ({
        key: category.key,
        label: localise(category.labelI18n, locale),
        description: localise(category.descriptionI18n, locale),
        icon: category.icon,
        sortOrder: category.sortOrder,
        requiresUrgentReview: category.requiresUrgentReview,
      })),
    };
  }

  /**
   * Picks the requested locale and falls back to English.
   *
   * English is the fallback everywhere because it is the only language the
   * development team can be certain is complete. The response also carries the
   * locale actually used, so the interface can tell the reader rather than
   * silently showing a language they did not ask for.
   */
  }

/**
 * Query for the category list.
 *
 * Declared as a DTO so an unrecognised locale is a validation error rather than
 * a silent fall-back to English — a reader who asked for Tigrinya and got
 * English should be able to tell that something went wrong.
 */
class ReportCategoryQueryDto {
  @IsOptional()
  @IsEnum(SUPPORTED_LOCALES)
  locale?: SupportedLocale;
}

@ApiTags('Report categories')
@Controller('report-categories')
export class ReportCategoriesController {
  constructor(private readonly service: ReportCategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Active report categories' })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: SUPPORTED_LOCALES,
    description:
      'Language for the labels. Defaults to English, which is the development ' +
      'fallback; a category whose translation is missing is shown in English.',
  })
  list(@Query() query: ReportCategoryQueryDto) {
    return this.service.listActive(query.locale ?? 'en');
  }
}
