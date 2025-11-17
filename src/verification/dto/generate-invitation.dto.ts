import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsDateString } from 'class-validator';

export class GenerateInvitationCodeDto {
  @ApiProperty({ example: 'building-uuid' })
  @IsUUID()
  buildingId: string;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
