import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChatModule } from '~/chat/chat.module';
import { NotificationsModule } from '~/notifications/notifications.module';

@Module({
  imports: [PrismaModule, ChatModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
