import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokeModerationDto {
  @ApiProperty({ description: 'Reason for revoking the moderation action' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
