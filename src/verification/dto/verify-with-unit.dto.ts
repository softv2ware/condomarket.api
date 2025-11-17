import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class VerifyWithUnitDto {
  @ApiProperty({ example: 'building-uuid' })
  @IsUUID()
  buildingId: string;

  @ApiProperty({ example: '101' })
  @IsString()
  unitNumber: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  lastName: string;
}
