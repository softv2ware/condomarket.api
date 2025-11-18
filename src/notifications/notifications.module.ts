import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '~/common/prisma/prisma.module';
import { FirebaseModule } from '~/common/firebase/firebase.module';

@Module({
  imports: [PrismaModule, FirebaseModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
