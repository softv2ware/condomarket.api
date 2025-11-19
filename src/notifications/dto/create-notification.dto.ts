import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsObject,
} from 'class-validator';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID to send notification to' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: NotificationType, description: 'Type of notification' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification message content' })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    isArray: true,
    description: 'Channels to send through',
  })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  @IsOptional()
  channels?: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'Additional data payload (can include related entity IDs)',
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}
