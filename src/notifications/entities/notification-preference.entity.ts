import { NotificationType, NotificationChannel } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationPreferenceEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  channel: NotificationChannel;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<NotificationPreferenceEntity>) {
    Object.assign(this, partial);
  }
}
