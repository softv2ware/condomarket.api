import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import firebaseConfig from './config/firebase.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, firebaseConfig],
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
