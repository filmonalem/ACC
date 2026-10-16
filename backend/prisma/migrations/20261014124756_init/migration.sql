-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('RESIDENT', 'TRIAGE_OFFICER', 'SERVICE_OFFICER', 'CONTENT_EDITOR', 'SUPERVISOR', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_INVITE', 'ACTIVE', 'DISABLED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EscalationState" AS ENUM ('NONE', 'REVIEW_PENDING', 'ESCALATED_INTERNAL', 'ESCALATION_CLOSED');

-- CreateEnum
CREATE TYPE "IncidentTimePrecision" AS ENUM ('EXACT', 'DATE_ONLY', 'APPROXIMATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LocationPrecision" AS ENUM ('KEBELE', 'WOREDA', 'SUB_CITY', 'LANDMARK_DESCRIPTION', 'PRECISE');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('PHONE', 'SMS', 'EMAIL', 'NONE');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('INTERNAL');

-- CreateEnum
CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR', 'SKIPPED_DEV');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('EMERGENCY', 'POLICE', 'HEALTH', 'FIRE', 'UTILITY', 'TRANSPORT', 'COMMUNITY', 'GOVERNMENT_OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('DRAFT', 'VERIFIED', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContactVerificationOutcome" AS ENUM ('CONFIRMED', 'UNREACHABLE', 'INCORRECT', 'EXPIRED', 'WITHDRAWN_BY_PROVIDER');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('PHONE_CALL', 'SMS_CONFIRMATION', 'EMAIL_CONFIRMATION', 'OFFICIAL_LETTER', 'SITE_VISIT', 'IN_PERSON_CONFIRMATION');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('PUBLIC_SAFETY', 'SERVICE_NOTICE', 'HEALTH_ADVISORY', 'INFRASTRUCTURE', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportServiceCategory" AS ENUM ('COMMUNITY_ASSISTANCE', 'HEALTH', 'SOCIAL_SUPPORT', 'DISABILITY_SUPPORT', 'PUBLIC_INFORMATION');

-- CreateEnum
CREATE TYPE "ServiceVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PERSONAL_DATA_PROCESSING', 'CONTACT_ATTEMPTS', 'RETENTION_EXTENSION', 'MARKETING');

-- CreateEnum
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'DELETION', 'OBJECTION', 'RESTRICTION');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('RECEIVED', 'IDENTITY_VERIFIED', 'IN_PROGRESS', 'FULFILLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_INVITE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "mfaRecoveryCodeHashes" TEXT[],
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "sessionsInvalidatedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "replacedById" UUID,
    "userAgentHash" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionCode" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionCode")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "organizationId" UUID,
    "grantedById" UUID,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "ReportCategory" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "labelI18n" JSONB NOT NULL,
    "descriptionI18n" JSONB,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresUrgentReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReportCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "referenceCode" VARCHAR(24) NOT NULL,
    "statusTokenHash" CHAR(64) NOT NULL,
    "categoryId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "escalationState" "EscalationState" NOT NULL DEFAULT 'NONE',
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "incidentOccurredAt" TIMESTAMP(3),
    "incidentTimePrecision" "IncidentTimePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "reporterConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstReviewedAt" TIMESTAMP(3),
    "duplicateOfReportId" UUID,
    "idempotencyKey" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportReporterIdentity" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "preferredContactMethod" "ContactMethod",
    "languagePreference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportReporterIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportLocation" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "precision" "LocationPrecision" NOT NULL DEFAULT 'KEBELE',
    "subCityName" TEXT,
    "woredaName" TEXT,
    "kebeleName" TEXT,
    "landmarkDescription" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAssignment" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "assigneeId" UUID NOT NULL,
    "organizationId" UUID,
    "assignedById" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "unassignedById" UUID,
    "note" TEXT,

    CONSTRAINT "ReportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportStatusHistory" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "fromStatus" "ReportStatus" NOT NULL,
    "toStatus" "ReportStatus" NOT NULL,
    "urgencyBefore" "Urgency",
    "urgencyAfter" "Urgency",
    "verificationBefore" "VerificationStatus",
    "verificationAfter" "VerificationStatus",
    "escalationBefore" "EscalationState",
    "escalationAfter" "EscalationState",
    "changedById" UUID,
    "changedByName" TEXT NOT NULL,
    "reason" TEXT,
    "requestId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportNote" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "requestId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAttachment" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "objectKey" VARCHAR(512) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(120) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "scanStatus" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanDetail" TEXT,
    "scannedAt" TIMESTAMP(3),
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceContact" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ServiceCategory" NOT NULL,
    "nameI18n" JSONB,
    "descriptionI18n" JSONB,
    "phoneNumber" VARCHAR(32) NOT NULL,
    "alternatePhone" VARCHAR(32),
    "phoneE164" VARCHAR(20),
    "coverageArea" TEXT,
    "availabilityNotes" TEXT,
    "alternativeInstructions" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContactStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationExpiresAt" TIMESTAMP(3),
    "verificationCycleDays" INTEGER NOT NULL DEFAULT 180,
    "nextReviewDueAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFictionalDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactVerification" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "outcome" "ContactVerificationOutcome" NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "verifiedById" UUID NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" UUID,
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "category" "AnnouncementCategory" NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceName" TEXT,
    "organizationId" UUID,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isFictionalDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementTranslation" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" VARCHAR(600),
    "body" TEXT NOT NULL,
    "isHumanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportService" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "slug" VARCHAR(160) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SupportServiceCategory" NOT NULL,
    "nameI18n" JSONB,
    "descriptionI18n" JSONB,
    "serviceArea" TEXT,
    "eligibility" TEXT,
    "eligibilityI18n" JSONB,
    "contactName" TEXT,
    "phoneNumber" TEXT,
    "phoneE164" VARCHAR(20),
    "email" TEXT,
    "websiteUrl" TEXT,
    "hoursNotes" TEXT,
    "verificationStatus" "ServiceVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verificationExpiresAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFictionalDemo" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupportService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "reportId" UUID,
    "userId" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "template" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "dedupeKey" VARCHAR(160),
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "reportId" UUID,
    "userId" UUID,
    "consentType" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" VARCHAR(40) NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipHash" CHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" UUID NOT NULL,
    "requestType" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "subjectUserId" UUID,
    "reportReferenceCode" VARCHAR(24),
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "requesterPhone" TEXT,
    "details" TEXT NOT NULL,
    "identityVerifiedAt" TIMESTAMP(3),
    "verificationMethod" VARCHAR(120),
    "handledById" UUID,
    "resolutionNote" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID,
    "actorEmail" TEXT,
    "actorRoles" TEXT[],
    "organizationId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(120) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "metadata" JSONB,
    "reason" VARCHAR(600),
    "requestId" VARCHAR(64),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" VARCHAR(128) NOT NULL,
    "scope" VARCHAR(60) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseBody" JSONB,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LegalHold" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "privacyRequestId" UUID,
    "reason" VARCHAR(300) NOT NULL,
    "placedById" UUID,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX "Role_key_idx" ON "Role"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionCode_idx" ON "RolePermission"("permissionCode");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "UserRole_organizationId_idx" ON "UserRole"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_isApproved_isActive_idx" ON "Organization"("isApproved", "isActive");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_leftAt_idx" ON "OrganizationMembership"("organizationId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCategory_key_key" ON "ReportCategory"("key");

-- CreateIndex
CREATE INDEX "ReportCategory_isActive_sortOrder_idx" ON "ReportCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Report_referenceCode_key" ON "Report"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Report_statusTokenHash_key" ON "Report"("statusTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Report_idempotencyKey_key" ON "Report"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Report_status_submittedAt_idx" ON "Report"("status", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "Report_categoryId_status_idx" ON "Report"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Report_urgency_status_idx" ON "Report"("urgency", "status");

-- CreateIndex
CREATE INDEX "Report_verificationStatus_status_idx" ON "Report"("verificationStatus", "status");

-- CreateIndex
CREATE INDEX "Report_escalationState_idx" ON "Report"("escalationState");

-- CreateIndex
CREATE INDEX "Report_submittedAt_idx" ON "Report"("submittedAt" DESC);

-- CreateIndex
CREATE INDEX "Report_duplicateOfReportId_idx" ON "Report"("duplicateOfReportId");

-- CreateIndex
CREATE INDEX "Report_deletedAt_idx" ON "Report"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportReporterIdentity_reportId_key" ON "ReportReporterIdentity"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportLocation_reportId_key" ON "ReportLocation"("reportId");

-- CreateIndex
CREATE INDEX "ReportAssignment_reportId_active_idx" ON "ReportAssignment"("reportId", "active");

-- CreateIndex
CREATE INDEX "ReportAssignment_assigneeId_active_idx" ON "ReportAssignment"("assigneeId", "active");

-- CreateIndex
CREATE INDEX "ReportAssignment_organizationId_idx" ON "ReportAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "ReportStatusHistory_reportId_createdAt_idx" ON "ReportStatusHistory"("reportId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReportStatusHistory_toStatus_createdAt_idx" ON "ReportStatusHistory"("toStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReportStatusHistory_changedById_idx" ON "ReportStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "ReportNote_reportId_createdAt_idx" ON "ReportNote"("reportId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReportNote_authorId_idx" ON "ReportNote"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAttachment_objectKey_key" ON "ReportAttachment"("objectKey");

-- CreateIndex
CREATE INDEX "ReportAttachment_reportId_deletedAt_idx" ON "ReportAttachment"("reportId", "deletedAt");

-- CreateIndex
CREATE INDEX "ReportAttachment_scanStatus_idx" ON "ReportAttachment"("scanStatus");

-- CreateIndex
CREATE INDEX "ServiceContact_isPublished_status_idx" ON "ServiceContact"("isPublished", "status");

-- CreateIndex
CREATE INDEX "ServiceContact_category_sortOrder_idx" ON "ServiceContact"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "ServiceContact_verificationExpiresAt_idx" ON "ServiceContact"("verificationExpiresAt");

-- CreateIndex
CREATE INDEX "ServiceContact_nextReviewDueAt_idx" ON "ServiceContact"("nextReviewDueAt");

-- CreateIndex
CREATE INDEX "ServiceContact_deletedAt_idx" ON "ServiceContact"("deletedAt");

-- CreateIndex
CREATE INDEX "ContactVerification_contactId_verifiedAt_idx" ON "ContactVerification"("contactId", "verifiedAt" DESC);

-- CreateIndex
CREATE INDEX "ContactVerification_verifiedById_idx" ON "ContactVerification"("verifiedById");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_slug_key" ON "Announcement"("slug");

-- CreateIndex
CREATE INDEX "Announcement_status_publishedAt_idx" ON "Announcement"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Announcement_category_status_idx" ON "Announcement"("category", "status");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");

-- CreateIndex
CREATE INDEX "AnnouncementTranslation_locale_idx" ON "AnnouncementTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementTranslation_announcementId_locale_key" ON "AnnouncementTranslation"("announcementId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "SupportService_slug_key" ON "SupportService"("slug");

-- CreateIndex
CREATE INDEX "SupportService_isPublished_verificationStatus_idx" ON "SupportService"("isPublished", "verificationStatus");

-- CreateIndex
CREATE INDEX "SupportService_category_sortOrder_idx" ON "SupportService"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "SupportService_deletedAt_idx" ON "SupportService"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledFor_idx" ON "Notification"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Notification_reportId_idx" ON "Notification"("reportId");

-- CreateIndex
CREATE INDEX "ConsentRecord_reportId_consentType_idx" ON "ConsentRecord"("reportId", "consentType");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE INDEX "PrivacyRequest_status_dueAt_idx" ON "PrivacyRequest"("status", "dueAt");

-- CreateIndex
CREATE INDEX "PrivacyRequest_subjectUserId_idx" ON "PrivacyRequest"("subjectUserId");

-- CreateIndex
CREATE INDEX "PrivacyRequest_reportReferenceCode_idx" ON "PrivacyRequest"("reportReferenceCode");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "LegalHold_reportId_releasedAt_idx" ON "LegalHold"("reportId", "releasedAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "Permission"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ReportCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_duplicateOfReportId_fkey" FOREIGN KEY ("duplicateOfReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportReporterIdentity" ADD CONSTRAINT "ReportReporterIdentity_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLocation" ADD CONSTRAINT "ReportLocation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAssignment" ADD CONSTRAINT "ReportAssignment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAssignment" ADD CONSTRAINT "ReportAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAssignment" ADD CONSTRAINT "ReportAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportStatusHistory" ADD CONSTRAINT "ReportStatusHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportStatusHistory" ADD CONSTRAINT "ReportStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNote" ADD CONSTRAINT "ReportNote_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportNote" ADD CONSTRAINT "ReportNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAttachment" ADD CONSTRAINT "ReportAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAttachment" ADD CONSTRAINT "ReportAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceContact" ADD CONSTRAINT "ServiceContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactVerification" ADD CONSTRAINT "ContactVerification_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ServiceContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactVerification" ADD CONSTRAINT "ContactVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactVerification" ADD CONSTRAINT "ContactVerification_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementTranslation" ADD CONSTRAINT "AnnouncementTranslation_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportService" ADD CONSTRAINT "SupportService_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
