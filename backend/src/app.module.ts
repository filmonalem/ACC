import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ReportsModule } from './modules/reports/reports.module';
import { ReportCategoriesModule } from './modules/report-categories/report-categories.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { SupportServicesModule } from './modules/support-services/support-services.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { parseEnv } from './config/parse-env';

/**
 * The rate-limit table below is built from `parseEnv()` at module-evaluation
 * time, before `ConfigModule` exists, because `ThrottlerModule.forRoot` is a
 * static call. Reading it once here means the limits the throttler enforces are
 * the same validated values every other consumer sees.
 */
const env = parseEnv();

/**
 * Guard order matters and is deliberate:
 *
 *   1. Throttler   — reject a flood before spending anything on crypto.
 *   2. JwtAuth     — establishes the principal.
 *   3. Csrf        — verifies a browser really issued the mutation.
 *   4. Permissions — the actual authorization decision.
 *
 * Running permissions before authentication would make every denial an
 * anonymous one, and the audit log would record denials without an actor.
 */
@Module({
  imports: [
    /**
     * Exactly ONE global throttler.
     *
     * `ThrottlerGuard` iterates every configured throttler and applies each one
     * to every route — a named throttler is not "opt-in", it is an additional
     * limit that everything must satisfy. Configuring `report-submission` with a
     * limit of 5 per ten minutes therefore capped *every* endpoint in the
     * application, including health checks and the staff dashboard, at five
     * requests per ten minutes per address. For a pilot served over one shared
     * connection that would look like the whole site was down.
     *
     * Endpoint-specific limits are therefore expressed with `@Throttle(...)` on
     * the individual route, which overrides the global value for that route
     * only. See `PublicReportsController` for the two that matter.
     */
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_MAX,
      },
    ]),
    ConfigModule,
    DatabaseModule,
    CommonModule,
    AuthModule,
    HealthModule,
    ReportCategoriesModule,
    ReportsModule,
    AttachmentsModule,
    ContactsModule,
    AnnouncementsModule,
    SupportServicesModule,
    UsersModule,
    AuditModule,
    PrivacyModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // CSRF runs after authentication, so an unauthenticated request is refused
    // as "sign in" rather than "bad token", and before permissions, so a forged
    // cross-site mutation never reaches the authorization decision.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
