import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'New status for the order',
    enum: OrderStatus,
    example: 'CONFIRMED',
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change (especially for cancellations)',
    example: 'Item no longer available',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
