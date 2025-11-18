import { IsString, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiPropertyOptional({ description: 'Order ID (for product orders)' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Booking ID (for service bookings)' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiProperty({ description: 'Rating from 1 to 5 stars', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: 'Review comment (max 500 chars)', maxLength: 500 })
  @IsOptional()
  @IsString()
  comment?: string;
}
