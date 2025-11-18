import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewType, ReviewStatus } from '@prisma/client';

export class ReviewEntity {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  orderId?: string;

  @ApiPropertyOptional()
  bookingId?: string;

  @ApiProperty()
  reviewerId: string;

  @ApiProperty()
  revieweeId: string;

  @ApiProperty()
  listingId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional()
  comment?: string;

  @ApiPropertyOptional()
  response?: string;

  @ApiProperty({ enum: ReviewType })
  type: ReviewType;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  respondedAt?: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RatingSummaryEntity {
  @ApiProperty({ description: 'Average rating' })
  averageRating: number;

  @ApiProperty({ description: 'Total number of reviews' })
  totalReviews: number;

  @ApiProperty({ description: 'Rating distribution by stars' })
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
