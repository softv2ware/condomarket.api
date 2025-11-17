import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SellerSubscriptionsModule } from '../seller-subscriptions/seller-subscriptions.module';

@Module({
  imports: [PrismaModule, SellerSubscriptionsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
