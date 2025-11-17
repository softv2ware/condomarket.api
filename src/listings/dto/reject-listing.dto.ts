import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectListingDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Inappropriate content or violates community guidelines',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  reason: string;
}
