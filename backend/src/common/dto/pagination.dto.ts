import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const MAX_PAGE_SIZE = 100;

/**
 * Base for every list endpoint.
 *
 * pageSize is capped at 100 rather than merely validated, because an unbounded
 * `?pageSize=100000` is both an availability problem and a way to exfiltrate a
 * whole table through one response.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: `pageSize must be ${MAX_PAGE_SIZE} or fewer` })
  pageSize = 25;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

export class PageMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;

  static build(page: number, pageSize: number, total: number): PageMetaDto {
    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}

export class PaginatedResponse<T> {
  @ApiProperty({ isArray: true })
  data!: T[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;

  static of<T>(data: T[], page: number, pageSize: number, total: number): PaginatedResponse<T> {
    return { data, meta: PageMetaDto.build(page, pageSize, total) };
  }
}

/** Sort direction shared by every sortable list. */
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
