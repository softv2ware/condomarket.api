import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CategoryType } from '../../prisma/client';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Electronics',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Electronic devices and accessories',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Category type',
    enum: CategoryType,
    example: CategoryType.PRODUCT,
  })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchical categories',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Building ID for building-specific categories',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({
    description: 'Category icon name or URL',
    example: 'electronics',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;
}
