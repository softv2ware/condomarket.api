import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min, IsOptional } from 'class-validator';

export class UploadPhotoDto {
  @ApiProperty({
    description: 'Whether this is the main photo for the listing',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isMain?: boolean;

  @ApiProperty({
    description: 'Display order of the photo',
    example: 1,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
