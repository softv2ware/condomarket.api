import { ApiProperty } from '@nestjs/swagger';
import {
  Transaction as PrismaTransaction,
  TransactionStatus,
  TransactionPaymentMethod,
} from 'src/prisma/client';

export class Transaction implements Partial<PrismaTransaction> {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  orderId?: string;

  @ApiProperty({ required: false })
  bookingId?: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: TransactionPaymentMethod })
  paymentMethod: TransactionPaymentMethod;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ required: false })
  paidAt?: Date;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
