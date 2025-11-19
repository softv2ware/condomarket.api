import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ReportType, ReportReason } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ enum: ReportType, description: 'Type of report' })
  @IsEnum(ReportType)
  @IsNotEmpty()
  reportType: ReportType;

  @ApiProperty({
    description: 'Type of entity being reported (e.g., Listing, User, Review)',
  })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty({ description: 'ID of the entity being reported' })
  @IsUUID()
  @IsNotEmpty()
  entityId: string;

  @ApiProperty({ enum: ReportReason, description: 'Reason for report' })
  @IsEnum(ReportReason)
  @IsNotEmpty()
  reason: ReportReason;

  @ApiPropertyOptional({ description: 'Additional description or context' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Building ID (if building-scoped)' })
  @IsUUID()
  @IsOptional()
  buildingId?: string;
}
