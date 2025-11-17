import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: '101' })
  @IsString()
  unitNumber: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ example: '2BR' })
  @IsString()
  @IsOptional()
  type?: string;
}
