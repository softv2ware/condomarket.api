import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditMessageDto {
  @ApiProperty({ description: 'Updated message content' })
  @IsString()
  content: string;
}
