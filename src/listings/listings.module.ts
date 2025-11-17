import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SellerSubscriptionsModule } from '../seller-subscriptions/seller-subscriptions.module';
import { S3Module } from '../common/s3/s3.module';

@Module({
  imports: [PrismaModule, SellerSubscriptionsModule, S3Module],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
