import { IsEnum, IsBoolean } from 'class-validator';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({
    enum: NotificationType,
    description: 'Notification type to update',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel, description: 'Channel to update' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Enable or disable this notification type for this channel',
  })
  @IsBoolean()
  enabled: boolean;
}
