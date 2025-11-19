import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BuildingsModule } from './buildings/buildings.module';
import { VerificationModule } from './verification/verification.module';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { S3Module } from './common/s3/s3.module';
import { SchedulerModule } from './common/scheduler/scheduler.module';
import { FirebaseModule } from './common/firebase/firebase.module';
import { validate } from './config/validation';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { SellerSubscriptionsModule } from './seller-subscriptions/seller-subscriptions.module';
import { ListingsModule } from './listings/listings.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { BookingsModule } from './bookings/bookings.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ChatModule } from './chat/chat.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { ModerationModule } from './moderation/moderation.module';
import { ReputationModule } from './reputation/reputation.module';
import { BlockingModule } from './blocking/blocking.module';
import { BuildingSettingsModule } from './building-settings/building-settings.module';
import { AnalyticsModule } from './analytics/analytics.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import firebaseConfig from './config/firebase.config';
import cacheConfig from './config/cache.config';
import emailConfig from './config/email.config';
import { CacheModule } from './common/cache/cache.module';
import { EmailModule } from './common/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        firebaseConfig,
        cacheConfig,
        emailConfig,
      ],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('app.rateLimit.ttl') || 60000,
          limit: config.get('app.rateLimit.limit') || 10,
        },
      ],
    }),
    LoggerModule,
    PrismaModule,
    CacheModule,
    EmailModule,
    HealthModule,
    S3Module,
    SchedulerModule,
    FirebaseModule,
    AuthModule,
    BuildingsModule,
    VerificationModule,
    UsersModule,
    SubscriptionPlansModule,
    SellerSubscriptionsModule,
    ListingsModule,
    CategoriesModule,
    OrdersModule,
    BookingsModule,
    TransactionsModule,
    ChatModule,
    ReviewsModule,
    NotificationsModule,
    ReportsModule,
    ModerationModule,
    ReputationModule,
    BlockingModule,
    BuildingSettingsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
