import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewVerificationDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ example: 'Verification documents confirmed' })
  @IsString()
  @IsOptional()
  reason?: string;
}
