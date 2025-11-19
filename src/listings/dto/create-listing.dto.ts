import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ListingType, AvailabilityType } from '@prisma/client';

export class CreateListingDto {
  @ApiProperty({
    description: 'Type of listing',
    enum: ListingType,
    example: ListingType.PRODUCT,
  })
  @IsEnum(ListingType)
  type: ListingType;

  @ApiProperty({
    description: 'Listing title',
    example: 'Gently Used Couch - Great Condition',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Detailed description',
    example:
      'A comfortable 3-seater couch in excellent condition. Smoke-free home.',
  })
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiProperty({
    description: 'Category UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description: 'Building UUID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  buildingId: string;

  @ApiProperty({
    description: 'Price in the specified currency',
    example: 150.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Availability type',
    enum: AvailabilityType,
    default: AvailabilityType.ALWAYS,
    required: false,
  })
  @IsOptional()
  @IsEnum(AvailabilityType)
  availabilityType?: AvailabilityType;

  @ApiProperty({
    description: 'Pickup location for products',
    example: 'Unit 101, Lobby, or Building Entrance',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLocation?: string;

  @ApiProperty({
    description: 'Whether delivery is available',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  deliveryAvailable?: boolean;

  @ApiProperty({
    description: 'Duration in minutes for services',
    example: 60,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;
}
