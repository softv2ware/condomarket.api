import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChatModule } from '~/chat/chat.module';
import { NotificationsModule } from '~/notifications/notifications.module';

@Module({
  imports: [PrismaModule, ChatModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
