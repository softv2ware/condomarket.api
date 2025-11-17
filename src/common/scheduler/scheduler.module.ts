import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { OrdersModule } from '../../orders/orders.module';
import { BookingsModule } from '../../bookings/bookings.module';

@Module({
  imports: [ScheduleModule.forRoot(), OrdersModule, BookingsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
