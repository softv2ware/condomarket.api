import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class VerifyWithInvitationCodeDto {
  @ApiProperty({ example: 'ABC123XYZ' })
  @IsString()
  code: string;
}
