import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123xyz456' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'newPassword123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
