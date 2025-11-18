import { IsOptional, IsInt, Min, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ReviewType } from '@prisma/client';

export class GetReviewsDto {
  @ApiPropertyOptional({ description: 'Filter by listing ID' })
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID (as reviewer or reviewee)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: ReviewType, description: 'Filter by review type' })
  @IsOptional()
  @IsEnum(ReviewType)
  type?: ReviewType;

  @ApiPropertyOptional({ description: 'Minimum rating filter', minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
