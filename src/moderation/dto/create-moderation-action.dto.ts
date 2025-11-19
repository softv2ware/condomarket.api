import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ModerationType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModerationActionDto {
  @ApiProperty({ description: 'Type of entity being moderated (e.g., User, Listing, Review)' })
  @IsString()
  @IsNotEmpty()
  targetType: string;

  @ApiProperty({ description: 'ID of the entity being moderated' })
  @IsUUID()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({ enum: ModerationType, description: 'Type of moderation action' })
  @IsEnum(ModerationType)
  @IsNotEmpty()
  actionType: ModerationType;

  @ApiProperty({ description: 'Reason for the moderation action' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Expiration date for temporary actions (ISO string)' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Building ID (if building-scoped)' })
  @IsUUID()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}
