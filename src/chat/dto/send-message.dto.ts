import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Additional metadata for images, files, etc.' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
