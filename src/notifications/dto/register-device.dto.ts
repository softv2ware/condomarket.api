import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM device token' })
  @IsString()
  token: string;

  @ApiPropertyOptional({ description: 'Device type: ios, android, web' })
  @IsString()
  @IsOptional()
  deviceType?: string;

  @ApiPropertyOptional({ description: 'Device name for identification' })
  @IsString()
  @IsOptional()
  deviceName?: string;
}
