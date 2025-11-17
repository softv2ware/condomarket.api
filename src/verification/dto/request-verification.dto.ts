import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class RequestVerificationDto {
  @ApiProperty({ example: 'building-uuid' })
  @IsUUID()
  buildingId: string;

  @ApiPropertyOptional({ example: 'unit-uuid' })
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional({ example: 'Additional information for admin review' })
  @IsString()
  @IsOptional()
  notes?: string;
}
