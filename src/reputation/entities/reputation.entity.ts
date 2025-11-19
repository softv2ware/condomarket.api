import { UserReputation } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class ReputationEntity implements Partial<UserReputation> {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  sellerRating?: number;

  @ApiProperty()
  totalSales: number;

  @ApiProperty()
  salesVolume: number;

  @ApiProperty({ required: false })
  buyerRating?: number;

  @ApiProperty()
  totalPurchases: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty({ required: false })
  responseTime?: number;

  @ApiProperty()
  responseRate: number;

  @ApiProperty()
  reliabilityScore: number;

  @ApiProperty()
  trustedSeller: boolean;

  @ApiProperty()
  fastResponder: boolean;

  @ApiProperty()
  topRated: boolean;

  @ApiProperty()
  lastCalculatedAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<UserReputation>) {
    Object.assign(this, partial);
  }
}
