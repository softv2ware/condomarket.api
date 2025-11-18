import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { NotificationsService } from '~/notifications/notifications.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { EditReviewDto } from './dto/edit-review.dto';
import { RespondToReviewDto } from './dto/respond-to-review.dto';
import { GetReviewsDto } from './dto/get-reviews.dto';
import {
  ReviewType,
  ReviewStatus,
  OrderStatus,
  BookingStatus,
  Prisma,
  NotificationType,
} from '@prisma/client';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a review for an order or booking
   */
  async create(userId: string, dto: CreateReviewDto) {
    // Must provide either orderId or bookingId
    if (!dto.orderId && !dto.bookingId) {
      throw new BadRequestException('Either orderId or bookingId must be provided');
    }

    if (dto.orderId && dto.bookingId) {
      throw new BadRequestException('Cannot provide both orderId and bookingId');
    }

    let order, booking, revieweeId, listingId, type: ReviewType;

    if (dto.orderId) {
      // Validate order
      order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { listing: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Only buyer can review
      if (order.buyerId !== userId) {
        throw new ForbiddenException('Only the buyer can review this order');
      }

      // Order must be completed
      if (order.status !== OrderStatus.COMPLETED) {
        throw new BadRequestException('Reviews can only be created for completed orders');
      }

      // Check if review already exists
      const existingReview = await this.prisma.review.findUnique({
        where: {
          orderId_reviewerId: {
            orderId: dto.orderId,
            reviewerId: userId,
          },
        },
      });

      if (existingReview) {
        throw new ConflictException('You have already reviewed this order');
      }

      revieweeId = order.sellerId;
      listingId = order.listingId;
      type = ReviewType.ORDER;
    } else {
      // Validate booking
      booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: { listing: true },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Only buyer can review
      if (booking.buyerId !== userId) {
        throw new ForbiddenException('Only the buyer can review this booking');
      }

      // Booking must be completed
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException('Reviews can only be created for completed bookings');
      }

      // Check if review already exists
      const existingReview = await this.prisma.review.findUnique({
        where: {
          bookingId_reviewerId: {
            bookingId: dto.bookingId!,
            reviewerId: userId,
          },
        },
      });

      if (existingReview) {
        throw new ConflictException('You have already reviewed this booking');
      }

      revieweeId = booking.sellerId;
      listingId = booking.listingId;
      type = ReviewType.BOOKING;
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        orderId: dto.orderId,
        bookingId: dto.bookingId,
        reviewerId: userId,
        revieweeId,
        listingId,
        rating: dto.rating,
        comment: dto.comment,
        type,
        status: ReviewStatus.ACTIVE,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true, profilePictureUrl: true },
            },
          },
        },
        reviewee: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        listing: {
          select: { id: true, title: true },
        },
      },
    });

    // Send notification to reviewee (seller) about new review
    try {
      await this.notificationsService.create({
        userId: revieweeId,
        type: NotificationType.REVIEW_RECEIVED,
        title: 'New Review Received',
        message: `You received a ${review.rating}-star review for ${review.listing.title}`,
        data: {
          reviewId: review.id,
          listingId: listingId,
          rating: review.rating.toString(),
          reviewType: type,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send review received notification: ${error.message}`);
    }

    return review;
  }

  /**
   * Get reviews with filters
   */
  async getReviews(dto: GetReviewsDto) {
    const { page = 1, limit = 20, listingId, userId, type, minRating } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      status: ReviewStatus.ACTIVE,
    };

    if (listingId) {
      where.listingId = listingId;
    }

    if (userId) {
      where.OR = [
        { reviewerId: userId },
        { revieweeId: userId },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (minRating) {
      where.rating = { gte: minRating };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          reviewer: {
            select: {
              id: true,
              profile: {
                select: { firstName: true, lastName: true, profilePictureUrl: true },
              },
            },
          },
          reviewee: {
            select: {
              id: true,
              profile: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          listing: {
            select: { id: true, title: true, photos: { take: 1 } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single review by ID
   */
  async getReviewById(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true, profilePictureUrl: true },
            },
          },
        },
        reviewee: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true, profilePictureUrl: true },
            },
          },
        },
        listing: {
          select: { id: true, title: true, photos: { take: 1 } },
        },
        order: {
          select: { id: true, status: true },
        },
        booking: {
          select: { id: true, status: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  /**
   * Get reviews for a specific listing
   */
  async getListingReviews(listingId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          listingId,
          status: ReviewStatus.ACTIVE,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              profile: {
                select: { firstName: true, lastName: true, profilePictureUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          listingId,
          status: ReviewStatus.ACTIVE,
        },
      }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get reviews for a specific user (as buyer/seller)
   */
  async getUserReviews(
    targetUserId: string,
    asRole: 'reviewer' | 'reviewee',
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      status: ReviewStatus.ACTIVE,
    };

    if (asRole === 'reviewer') {
      where.reviewerId = targetUserId;
    } else {
      where.revieweeId = targetUserId;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          reviewer: {
            select: {
              id: true,
              profile: {
                select: { firstName: true, lastName: true, profilePictureUrl: true },
              },
            },
          },
          reviewee: {
            select: {
              id: true,
              profile: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          listing: {
            select: { id: true, title: true, photos: { take: 1 } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get rating summary for a user or listing
   */
  async getRatingSummary(targetId: string, targetType: 'user' | 'listing') {
    const where: Prisma.ReviewWhereInput = {
      status: ReviewStatus.ACTIVE,
    };

    if (targetType === 'user') {
      where.revieweeId = targetId;
    } else {
      where.listingId = targetId;
    }

    const reviews = await this.prisma.review.findMany({
      where,
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const totalReviews = reviews.length;
    const sumRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = Math.round((sumRatings / totalReviews) * 10) / 10;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      distribution[review.rating as keyof typeof distribution]++;
    });

    return {
      averageRating,
      totalReviews,
      distribution,
    };
  }

  /**
   * Respond to a review (seller only)
   */
  async respondToReview(reviewId: string, userId: string, dto: RespondToReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Only the reviewee (seller) can respond
    if (review.revieweeId !== userId) {
      throw new ForbiddenException('Only the seller can respond to this review');
    }

    if (review.status !== ReviewStatus.ACTIVE) {
      throw new BadRequestException('Cannot respond to a flagged or removed review');
    }

    if (review.response) {
      throw new ConflictException('You have already responded to this review');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        response: dto.response,
        respondedAt: new Date(),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true, profilePictureUrl: true },
            },
          },
        },
        reviewee: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        listing: {
          select: { id: true, title: true },
        },
      },
    });

    // Send notification to reviewer about seller's response
    try {
      await this.notificationsService.create({
        userId: review.reviewerId,
        type: NotificationType.REVIEW_RESPONSE,
        title: 'Seller Responded to Your Review',
        message: `The seller responded to your review for ${updatedReview.listing.title}`,
        data: {
          reviewId: reviewId,
          listingId: review.listingId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send review response notification: ${error.message}`);
    }

    return updatedReview;
  }

  /**
   * Edit a review (within 24 hours)
   */
  async editReview(reviewId: string, userId: string, dto: EditReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewerId !== userId) {
      throw new ForbiddenException('You can only edit your own reviews');
    }

    if (review.status !== ReviewStatus.ACTIVE) {
      throw new BadRequestException('Cannot edit a flagged or removed review');
    }

    // Check if within 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (review.createdAt < twentyFourHoursAgo) {
      throw new BadRequestException('Reviews can only be edited within 24 hours');
    }

    const updateData: Prisma.ReviewUpdateInput = {};
    if (dto.rating !== undefined) {
      updateData.rating = dto.rating;
    }
    if (dto.comment !== undefined) {
      updateData.comment = dto.comment;
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        reviewer: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true, profilePictureUrl: true },
            },
          },
        },
        reviewee: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });
  }

  /**
   * Report a review (placeholder for moderation system)
   */
  async reportReview(reviewId: string, userId: string, reason: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // For now, just flag it if not already flagged
    if (review.status === ReviewStatus.ACTIVE) {
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { status: ReviewStatus.FLAGGED },
      });
    }

    // TODO: Create a proper Report record in Stage 7 (Moderation)
    return {
      success: true,
      message: 'Review has been reported and flagged for moderation',
    };
  }
}
