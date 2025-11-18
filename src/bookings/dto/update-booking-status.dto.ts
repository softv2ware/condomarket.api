import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingStatusDto {
  @ApiProperty({
    description: 'New status for the booking',
    enum: BookingStatus,
    example: 'CONFIRMED',
  })
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change (especially for cancellations)',
    example: 'Schedule conflict',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
