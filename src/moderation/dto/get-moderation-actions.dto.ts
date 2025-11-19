import { IsEnum, IsOptional, IsInt, Min, IsUUID } from 'class-validator';
import { ModerationType, ModerationStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetModerationActionsDto {
  @ApiPropertyOptional({ description: 'Filter by target type' })
  @IsOptional()
  targetType?: string;

  @ApiPropertyOptional({ description: 'Filter by target ID' })
  @IsUUID()
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({
    enum: ModerationType,
    description: 'Filter by action type',
  })
  @IsEnum(ModerationType)
  @IsOptional()
  actionType?: ModerationType;

  @ApiPropertyOptional({
    enum: ModerationStatus,
    description: 'Filter by status',
  })
  @IsEnum(ModerationStatus)
  @IsOptional()
  status?: ModerationStatus;

  @ApiPropertyOptional({ description: 'Filter by building ID' })
  @IsUUID()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
