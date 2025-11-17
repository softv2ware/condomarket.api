import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ 
    description: 'The email of the user',
    example: 'user@example.com'
  })
  email: string;

  @ApiProperty({ 
    description: 'The name of the user',
    example: 'John Doe'
  })
  name: string;
}
