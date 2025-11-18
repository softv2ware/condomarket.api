import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportReviewDto {
  @ApiProperty({ description: 'Reason for reporting this review', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason: string;
}
