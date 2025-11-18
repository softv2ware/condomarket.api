import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { DeliveryMethod } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({
    description: 'ID of the listing being ordered',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @ApiProperty({
    description: 'Quantity to order',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Delivery method',
    enum: DeliveryMethod,
    example: 'PICKUP',
  })
  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  @ApiPropertyOptional({
    description: 'Pickup location if delivery method is PICKUP',
    example: 'Lobby of Building A',
  })
  @IsOptional()
  @IsString()
  pickupLocation?: string;

  @ApiPropertyOptional({
    description: 'Delivery address if delivery method is DELIVERY',
    example: 'Unit 301, Building A',
  })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({
    description: 'Scheduled date/time for pickup or delivery',
    example: '2024-11-20T14:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the seller',
    example: 'Please call when you arrive',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
