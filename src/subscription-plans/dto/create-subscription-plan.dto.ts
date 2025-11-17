import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  IsUUID,
} from 'class-validator';
import { SubscriptionTier } from 'src/prisma/client';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Free Plan', description: 'Plan name' })
  @IsString()
  name: string;

  @ApiProperty({
    enum: SubscriptionTier,
    example: SubscriptionTier.FREE,
    description: 'Subscription tier',
  })
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @ApiPropertyOptional({
    example: 'Perfect for trying out the marketplace',
    description: 'Plan description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 0, description: 'Monthly price in currency units' })
  @IsNumber()
  @Min(0)
  monthlyPrice: number;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency code',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    example: 1,
    description: 'Maximum number of active listings allowed',
  })
  @IsNumber()
  @Min(1)
  maxActiveListings: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Sort priority (higher = better placement)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  sortPriority?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether listings get highlight styling',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isHighlightEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Auto-assign this plan to new users',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefaultFree?: boolean;

  @ApiPropertyOptional({
    example: 'building-uuid',
    description: 'Building ID for building-specific plan (null = platform-wide)',
  })
  @IsOptional()
  @IsUUID()
  buildingId?: string;
}
