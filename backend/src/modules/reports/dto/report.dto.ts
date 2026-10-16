import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../../../common/i18n/localise';

/**
 * Public submission DTOs.
 *
 * Length limits are enforced here rather than trusted from the database. A
 * report description capped at 5,000 characters is a bounded amount of data to
 * store, moderate and review; an unbounded text field is not, and validation
 * that only happens at the column level arrives after the row is already
 * written.
 */
export class SubmitReportDto {
  @ApiProperty({ description: 'Category key, e.g. `public_safety`.', example: 'public_safety' })
  @IsString()
  @MaxLength(60)
  categoryKey!: string;

  @ApiProperty({ description: 'What happened, in the resident\'s own words.' })
  @IsString()
  @MinLength(20, {
    message: 'Please describe the concern in at least 20 characters so staff can act on it.',
  })
  @MaxLength(5000, { message: 'Please shorten the description to 5000 characters or fewer.' })
  description!: string;

  @ApiProperty({
    description: 'Language the resident wants to be contacted in.',
    enum: ['en', 'ti', 'am'],
    example: 'ti',
  })
  @IsEnum(['en', 'ti', 'am'], { message: 'Choose one of the supported languages.' })
  language!: string;

  // ── optional incident timing ───────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'ISO 8601 timestamp of the incident.' })
  @IsOptional()
  @IsISO8601({}, { message: 'Enter a valid date and time.' })
  incidentOccurredAt!: string;

  @ApiPropertyOptional({
    description: 'How precise `incidentOccurredAt` is. Honest imprecision is better than a guess.',
    enum: ['EXACT', 'DATE_ONLY', 'APPROXIMATE', 'UNKNOWN'],
  })
  @IsOptional()
  @IsEnum(['EXACT', 'DATE_ONLY', 'APPROXIMATE', 'UNKNOWN'])
  incidentTimePrecision!: 'EXACT' | 'DATE_ONLY' | 'APPROXIMATE' | 'UNKNOWN';

  // ── optional location ──────────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: ['KEBELE', 'WOREDA', 'SUB_CITY', 'LANDMARK_DESCRIPTION'] })
  @IsOptional()
  @IsEnum(['KEBELE', 'WOREDA', 'SUB_CITY', 'LANDMARK_DESCRIPTION', 'PRECISE'])
  locationPrecision!: 'KEBELE' | 'WOREDA' | 'SUB_CITY' | 'LANDMARK_DESCRIPTION' | 'PRECISE';

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subCityName!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  woredaName!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  kebeleName!: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'A landmark description is preferred over coordinates by default.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  landmarkDescription!: string;

  @ApiPropertyOptional({
    description: 'Only accepted when ALLOW_PRECISE_LOCATIONS is on and the caller is permitted.',
  })
  @IsOptional()
  @Type(() => Number)
  latitude!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  longitude!: number;

  // ── optional contact details ───────────────────────────────────────────────
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reporterName!: string;

  @ApiPropertyOptional({
    description: 'Ethiopian mobile numbers are 09xxxxxxxx / 07xxxxxxxx.',
    example: '0912345678',
  })
  @IsOptional()
  @Matches(/^(\+?251)?0?9\d{8}$/, {
    message: 'Enter a valid Ethiopian mobile number, for example 0912345678.',
  })
  reporterPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  reporterEmail!: string;

  @ApiPropertyOptional({ enum: ['PHONE', 'SMS', 'EMAIL', 'NONE'] })
  @IsOptional()
  @IsEnum(['PHONE', 'SMS', 'EMAIL', 'NONE'])
  preferredContactMethod!: 'PHONE' | 'SMS' | 'EMAIL' | 'NONE';

  // ── privacy ───────────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    description:
      'Submit without leaving contact details. Rejected unless the operating ' +
      'organization has approved anonymous reporting — the platform cannot ' +
      'promise true anonymity, because server logs and file metadata can still ' +
      'identify a submitter.',
  })
  @IsOptional()
  @IsBoolean()
  isAnonymous!: boolean;

  @ApiProperty({
    description: 'The resident has read the privacy notice and agrees to processing.',
  })
  @IsBoolean()
  reporterConsentGiven!: boolean;
}

/**
 * Query string for the status lookup.
 *
 * Only the status token arrives here. The reference code is a *path* segment
 * (`GET /reports/:referenceCode/status`) and is validated separately by
 * `ReferenceCodeParam` below — binding it to this DTO as well would make the
 * `ValidationPipe` (which runs with `forbidNonWhitelisted`) demand a
 * `referenceCode` query parameter that the route never uses, so every lookup
 * would fail validation regardless of the token.
 */
export class ReportStatusLookupDto {
  @ApiProperty({
    description:
      'The single-use status token issued at submission. Required in addition ' +
      'to the reference code in the path, so a code alone reveals nothing.',
    example: 'the-token-from-confirmation',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  statusToken!: string;

  @ApiPropertyOptional({
    description:
      'Language for the status message. An unsupported value is rejected rather ' +
      'than silently falling back, so a client cannot believe it is serving a ' +
      'language it is not.',
    enum: SUPPORTED_LOCALES,
    example: 'ti',
  })
  @IsOptional()
  @IsEnum(SUPPORTED_LOCALES)
  locale?: SupportedLocale;
}

/**
 * The `:referenceCode` path segment.
 *
 * Bound with `@Param()` so the same shape constraint applies to the path as to
 * the token. `ACC-` plus 8 characters from the Crockford-style alphabet the
 * generator uses, so a malformed code is rejected as a client error instead of
 * reaching the database.
 */
export class ReferenceCodeParam {
  @ApiProperty({ example: 'ACC-7F3K9Q2M' })
  @IsString()
  @MaxLength(24)
  @Matches(/^ACC-[0-9A-HJKMNP-TV-Z]{8}$/, { message: 'Enter the reference code exactly as given.' })
  referenceCode!: string;
}

export class SubmitReportResponseDto {
  @ApiProperty({ example: 'ACC-7F3K9Q2M' })
  referenceCode!: string;

  @ApiProperty({
    description:
      'Single-use token. Shown once. Combined with the reference code it is the ' +
      'only way to check status, so store it safely.',
  })
  statusToken!: string;

  @ApiProperty() submittedAt!: string;
  @ApiProperty() status!: string;
}

// ── staff-side admin DTOs ────────────────────────────────────────────────────

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] })
  @IsEnum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'VERIFIED',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
    'REJECTED',
    'DUPLICATE',
  ])
  status!: string;

  @ApiPropertyOptional({ description: 'Required for rejections, duplications and reversals.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Set when resolving. Explains what was actually done.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, {
    message: 'Describe the resolution in at least 10 characters.',
  })
  @MaxLength(2000)
  resolutionNote!: string;
}

export class AssignReportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assigneeId!: string;

  @ApiPropertyOptional({ description: 'Organization the assignee is acting for.' })
  @IsOptional()
  @IsUUID()
  organizationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note!: string;
}

export class AddReportNoteDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class TriageReportDto {
  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsEnum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
  urgency!: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({ enum: ['UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REJECTED'] })
  @IsOptional()
  @IsEnum(['UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REJECTED'])
  verificationStatus!: 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED' | 'REJECTED';

  @ApiPropertyOptional({
    enum: ['NONE', 'REVIEW_PENDING', 'ESCALATED_INTERNAL', 'ESCALATION_CLOSED'],
    description:
      'Escalation notifies designated review personnel inside ACC only. It never ' +
      'contacts police, ambulance, or any external service.',
  })
  @IsOptional()
  @IsEnum(['NONE', 'REVIEW_PENDING', 'ESCALATED_INTERNAL', 'ESCALATION_CLOSED'])
  escalationState!: 'NONE' | 'REVIEW_PENDING' | 'ESCALATED_INTERNAL' | 'ESCALATION_CLOSED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class LinkDuplicateDto {
  @ApiProperty({
    description: 'Reference code of the report this one duplicates.',
    example: 'ACC-7F3K9Q2M',
  })
  @IsString()
  @Matches(/^ACC-[0-9A-HJKMNP-TV-Z]{8}$/, { message: 'Enter the reference code exactly as given.' })
  duplicateOfReferenceCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5, { message: 'Explain why these are the same concern.' })
  @MaxLength(1000)
  reason!: string;
}
