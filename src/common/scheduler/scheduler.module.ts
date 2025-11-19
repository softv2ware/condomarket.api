import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { OrdersModule } from '../../orders/orders.module';
import { BookingsModule } from '../../bookings/bookings.module';
import { ModerationModule } from '../../moderation/moderation.module';
import { ReputationModule } from '../../reputation/reputation.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    OrdersModule,
    BookingsModule,
    ModerationModule,
    ReputationModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
