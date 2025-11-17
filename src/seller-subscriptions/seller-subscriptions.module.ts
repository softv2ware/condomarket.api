import { Module } from '@nestjs/common';
import { SellerSubscriptionsService } from './seller-subscriptions.service';
import { SellerSubscriptionsController } from './seller-subscriptions.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SellerSubscriptionsController],
  providers: [SellerSubscriptionsService],
  exports: [SellerSubscriptionsService],
})
export class SellerSubscriptionsModule {}
