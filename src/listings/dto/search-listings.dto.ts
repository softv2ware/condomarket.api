import { IsOptional, IsEnum, IsString, IsNumber, Min, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ListingType, ListingStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class SearchListingsDto {
  @ApiProperty({
    description: 'Search query for title and description',
    required: false,
    example: 'couch',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({
    description: 'Filter by listing type',
    enum: ListingType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  @ApiProperty({
    description: 'Filter by category UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    description: 'Filter by building UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiProperty({
    description: 'Minimum price',
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({
    description: 'Maximum price',
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiProperty({
    description: 'Filter by status',
    enum: ListingStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
