import { IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ReportType, ReportStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetReportsDto {
  @ApiPropertyOptional({
    enum: ReportType,
    description: 'Filter by report type',
  })
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @ApiPropertyOptional({ enum: ReportStatus, description: 'Filter by status' })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiPropertyOptional({ description: 'Filter by entity type' })
  @IsOptional()
  entityType?: string;

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
