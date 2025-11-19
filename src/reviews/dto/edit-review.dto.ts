import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditReviewDto {
  @ApiPropertyOptional({
    description: 'Updated rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: 'Updated comment (max 500 chars)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
