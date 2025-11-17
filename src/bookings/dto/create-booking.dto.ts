import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'ID of the service listing being booked',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @ApiProperty({
    description: 'Start time for the service',
    example: '2024-11-20T14:00:00Z',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'End time for the service',
    example: '2024-11-20T16:00:00Z',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    description: 'Duration in minutes',
    example: 120,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiPropertyOptional({
    description: 'Location for the service',
    example: 'Unit 301, Building A',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the seller',
    example: 'Please bring cleaning supplies',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
