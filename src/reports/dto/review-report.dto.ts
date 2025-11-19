import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewReportDto {
  @ApiProperty({ description: 'Resolution or action taken' })
  @IsString()
  @IsNotEmpty()
  resolution: string;
}
