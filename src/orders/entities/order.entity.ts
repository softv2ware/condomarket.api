import { ApiProperty } from '@nestjs/swagger';
import {
  Order as PrismaOrder,
  OrderStatus,
  DeliveryMethod,
  ListingType,
} from '../../prisma/client';

export class Order implements Partial<PrismaOrder> {
  @ApiProperty()
  id: string;

  @ApiProperty()
  listingId: string;

  @ApiProperty()
  buyerId: string;

  @ApiProperty()
  sellerId: string;

  @ApiProperty()
  buildingId: string;

  @ApiProperty({ enum: ListingType })
  type: ListingType;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  totalPrice: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: DeliveryMethod })
  deliveryMethod: DeliveryMethod;

  @ApiProperty({ required: false })
  pickupLocation?: string;

  @ApiProperty({ required: false })
  deliveryAddress?: string;

  @ApiProperty({ required: false })
  scheduledFor?: Date;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  confirmedAt?: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty({ required: false })
  cancelledAt?: Date;

  @ApiProperty({ required: false })
  cancellationReason?: string;
}
