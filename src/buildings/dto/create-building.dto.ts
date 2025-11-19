import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BuildingType } from '@prisma/client';

export class CreateBuildingDto {
  @ApiProperty({ example: 'Sunset Towers' })
  @IsString()
  name: string;

  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsString()
  @IsOptional()
  zipCode?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    enum: BuildingType,
    example: BuildingType.APARTMENT_COMPLEX,
  })
  @IsEnum(BuildingType)
  @IsOptional()
  type?: BuildingType;

  @ApiPropertyOptional({ example: 'A modern apartment complex with amenities' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'uuid-of-admin' })
  @IsUUID()
  @IsOptional()
  adminId?: string;
}
