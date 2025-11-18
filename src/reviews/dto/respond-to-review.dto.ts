import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RespondToReviewDto {
  @ApiProperty({ description: 'Response to the review (max 500 chars)', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  response: string;
}
