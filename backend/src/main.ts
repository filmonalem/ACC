import 'reflect-metadata';
// Must come first. `parseEnv()` runs before Nest's ConfigModule has had a chance
// to load `.env`, so the file is read here explicitly. A real deployment injects
// real environment variables and this is then a no-op, because variables already
// present in the environment win.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { parseEnv } from './config/parse-env';

/**
 * Process bootstrap.
 *
 * Everything that shapes the security posture of the deployment is set here, in
 * one readable place, so a reviewer can check the whole picture without reading
 * a module: helmet, CORS, body limits, the validation pipe, trust proxy.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const env = parseEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Behind a reverse proxy, X-Forwarded-* is only trustworthy when we know how
    // many proxies are in front. Getting this wrong makes req.ip — which rate
    // limiting and audit logging both depend on — either a proxy address or
    // spoofable, so the hop count is configured explicitly rather than inferred.
    bodyParser: true,
  });

  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(
    helmet({
      // The API serves JSON and file downloads, never HTML, so the browser
      // policy that matters here is the framing and content-type one.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      // Keeps proxies from reporting the API version and environment to callers.
      hidePoweredBy: true,
    }),
  );

  app.use(cookieParser());

  /**
   * CORS.
   *
   * Credentials are enabled because staff authentication is cookie-based, so
   * the origin list must be explicit and exact. `*` is rejected by the env
   * schema in production, and refused again here so the rule holds in every
   * environment rather than only in production.
   */
  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin and non-browser clients send no Origin header.
      if (!origin) return callback(null, true);

      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);

      logger.warn(`Rejected a cross-origin request from ${origin}`);
      return callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', env.CSRF_HEADER_NAME, 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  /**
   * Body limits.
   *
   * Small because nothing legitimate is large: attachments go through the
   * upload endpoint with its own, stricter limit. A 100 KB JSON cap turns an
   * unbounded-body denial-of-service into a rejected request.
   */
  app.useBodyParser('json', { limit: '100kb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: false });

  /**
   * Global validation.
   *
   * `whitelist` strips unknown properties; `forbidNonWhitelisted` turns them
   * into an error. That pairing is deliberate — a silently ignored misspelled
   * field in a report submission is a report that is missing information its
   * author believed they gave.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  if (env.ENABLE_SWAGGER) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Adigrat Community Connect API')
        .setDescription(
          'Reports, verified service contacts, approved announcements and community ' +
            'support listings.\n\n' +
            '**ACC is a proposed civic technology initiative.** It is not a government ' +
            'service, is not connected to any emergency dispatch system, and does not ' +
            'guarantee a response time. Reports are reviewed by authorized staff during ' +
            'published hours only.',
        )
        .setVersion('0.1.0')
        .addCookieAuth(env.AUTH_COOKIE_NAME)
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Graceful shutdown so in-flight requests finish and the pool drains cleanly
  // rather than being cut off on every deploy.
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');

  logger.log(`ACC API listening on http://0.0.0.0:${env.PORT}/api/v1`);
  logger.log(`Environment: ${env.NODE_ENV}`);
  if (env.NODE_ENV === 'production') {
    logger.log('Swagger disabled by configuration in production.');
  }
}

void bootstrap();
