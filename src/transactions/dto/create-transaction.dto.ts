import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { TransactionPaymentMethod } from 'src/prisma/client';

export class CreateTransactionDto {
  @ApiPropertyOptional({
    description: 'ID of the order this transaction is for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.bookingId)
  @IsNotEmpty({ message: 'Either orderId or bookingId must be provided' })
  orderId?: string;

  @ApiPropertyOptional({
    description: 'ID of the booking this transaction is for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.orderId)
  @IsNotEmpty({ message: 'Either orderId or bookingId must be provided' })
  bookingId?: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 50.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Payment method used',
    enum: TransactionPaymentMethod,
    example: 'CASH',
  })
  @IsEnum(TransactionPaymentMethod)
  paymentMethod: TransactionPaymentMethod;

  @ApiPropertyOptional({
    description: 'Date when payment was received (ISO 8601)',
    example: '2024-11-20T14:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the transaction',
    example: 'Paid in cash at delivery',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
