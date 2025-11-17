import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, Max, Matches } from 'class-validator';

export class ListingAvailabilityDto {
  @ApiProperty({
    description: 'Day of week (0 = Sunday, 6 = Saturday)',
    minimum: 0,
    maximum: 6,
    example: 1,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Start time in HH:MM format (24-hour)',
    example: '09:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:MM format (24-hour)',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:MM format (24-hour)',
    example: '17:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:MM format (24-hour)',
  })
  endTime: string;
}

export class UpdateAvailabilityDto {
  @ApiProperty({
    description: 'Array of availability time slots',
    type: [ListingAvailabilityDto],
  })
  availability: ListingAvailabilityDto[];
}
