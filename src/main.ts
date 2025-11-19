import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const corsOrigins = configService.get<string[]>('app.corsOrigins') || ['http://localhost:3000'];

  // Security - Helmet with CSP configured for Scalar
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('CondoMarket API')
    .setDescription('The CondoMarket API documentation - Production Ready')
    .setVersion('1.0')
    .addTag('App', 'Application information')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Buildings', 'Building and unit management')
    .addTag('BuildingSettings', 'Building settings and configuration')
    .addTag('Verification', 'Resident verification')
    .addTag('Users', 'User management')
    .addTag('Listings', 'Marketplace listings')
    .addTag('Categories', 'Category management')
    .addTag('Orders', 'Order management for products')
    .addTag('Bookings', 'Booking management for services')
    .addTag('Transactions', 'Transaction history')
    .addTag('Reviews', 'Reviews and ratings')
    .addTag('Reputation', 'User reputation system')
    .addTag('Chat', 'Chat and messaging')
    .addTag('Notifications', 'User notifications')
    .addTag('Subscription-Plans', 'Subscription plans management')
    .addTag('Seller-Subscriptions', 'Seller subscription management')
    .addTag('Reports', 'User reports and flagging')
    .addTag('Moderation', 'Content moderation')
    .addTag('Blocking', 'User blocking')
    .addTag('Analytics', 'Analytics and reporting dashboards')
    .addTag('Health', 'Health check and monitoring endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup Scalar API Reference
  app.use(
    '/reference',
    apiReference({
      spec: {
        content: document,
      },
    }),
  );

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`API Reference available at: http://localhost:${port}/reference`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, starting graceful shutdown...`);
      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    });
  });
}
bootstrap();
