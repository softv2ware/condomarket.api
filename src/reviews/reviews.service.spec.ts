import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '~/prisma';
import { NotificationsService } from '~/notifications/notifications.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  ReviewType,
  ReviewStatus,
  OrderStatus,
  BookingStatus,
} from '@prisma/client';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    review: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
    },
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'buyer-1';

    it('should create a review for a completed order', async () => {
      const mockOrder = {
        id: 'order-1',
        buyerId: userId,
        sellerId: 'seller-1',
        listingId: 'listing-1',
        status: OrderStatus.COMPLETED,
        listing: { title: 'Test Product' },
      };

      const mockReview = {
        id: 'review-1',
        orderId: 'order-1',
        reviewerId: userId,
        revieweeId: 'seller-1',
        listingId: 'listing-1',
        rating: 5,
        comment: 'Great product!',
        type: ReviewType.ORDER,
        status: ReviewStatus.ACTIVE,
        reviewer: {
          id: userId,
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            profilePictureUrl: null,
          },
        },
        reviewee: {
          id: 'seller-1',
          profile: { firstName: 'Jane', lastName: 'Smith' },
        },
        listing: { id: 'listing-1', title: 'Test Product' },
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.review.findUnique.mockResolvedValue(null);
      mockPrismaService.review.create.mockResolvedValue(mockReview);

      const result = await service.create(userId, {
        orderId: 'order-1',
        rating: 5,
        comment: 'Great product!',
      });

      expect(result.rating).toBe(5);
      expect(result.type).toBe(ReviewType.ORDER);
      expect(mockPrismaService.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-1',
            reviewerId: userId,
            revieweeId: 'seller-1',
            listingId: 'listing-1',
            rating: 5,
            type: ReviewType.ORDER,
          }),
        }),
      );
    });

    it('should create a review for a completed booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        buyerId: userId,
        sellerId: 'seller-1',
        listingId: 'listing-1',
        status: BookingStatus.COMPLETED,
        listing: { title: 'Test Service' },
      };

      const mockReview = {
        id: 'review-1',
        bookingId: 'booking-1',
        reviewerId: userId,
        revieweeId: 'seller-1',
        listingId: 'listing-1',
        rating: 4,
        type: ReviewType.BOOKING,
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.review.findUnique.mockResolvedValue(null);
      mockPrismaService.review.create.mockResolvedValue(mockReview);

      const result = await service.create(userId, {
        bookingId: 'booking-1',
        rating: 4,
      });

      expect(result.type).toBe(ReviewType.BOOKING);
      expect(mockPrismaService.review.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when neither orderId nor bookingId provided', async () => {
      await expect(
        service.create(userId, { rating: 5 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when both orderId and bookingId provided', async () => {
      await expect(
        service.create(userId, {
          orderId: 'order-1',
          bookingId: 'booking-1',
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.create(userId, { orderId: 'order-1', rating: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the buyer', async () => {
      const mockOrder = {
        id: 'order-1',
        buyerId: 'other-user',
        status: OrderStatus.COMPLETED,
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.create(userId, { orderId: 'order-1', rating: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when order is not completed', async () => {
      const mockOrder = {
        id: 'order-1',
        buyerId: userId,
        status: OrderStatus.PENDING_CONFIRMATION,
        listing: {},
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.create(userId, { orderId: 'order-1', rating: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when review already exists', async () => {
      const mockOrder = {
        id: 'order-1',
        buyerId: userId,
        sellerId: 'seller-1',
        listingId: 'listing-1',
        status: OrderStatus.COMPLETED,
        listing: {},
      };

      const existingReview = { id: 'review-1' };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.review.findUnique.mockResolvedValue(existingReview);

      await expect(
        service.create(userId, { orderId: 'order-1', rating: 5 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getReviews', () => {
    it('should return paginated reviews with filters', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          reviewer: { id: 'user-1', profile: {} },
          reviewee: { id: 'user-2', profile: {} },
          listing: { id: 'listing-1', title: 'Test', photos: [] },
        },
      ];

      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.getReviews({
        listingId: 'listing-1',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            listingId: 'listing-1',
            status: ReviewStatus.ACTIVE,
          }),
        }),
      );
    });

    it('should filter by userId (reviewer or reviewee)', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.review.count.mockResolvedValue(0);

      await service.getReviews({ userId: 'user-1', page: 1, limit: 20 });

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ reviewerId: 'user-1' }, { revieweeId: 'user-1' }],
          }),
        }),
      );
    });

    it('should filter by minimum rating', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.review.count.mockResolvedValue(0);

      await service.getReviews({ minRating: 4, page: 1, limit: 20 });

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rating: { gte: 4 },
          }),
        }),
      );
    });
  });

  describe('getRatingSummary', () => {
    it('should calculate rating summary for a user', async () => {
      const mockReviews = [
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
        { rating: 5 },
      ];

      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getRatingSummary('user-1', 'user');

      expect(result.totalReviews).toBe(5);
      expect(result.averageRating).toBe(4.4);
      expect(result.distribution[5]).toBe(3);
      expect(result.distribution[4]).toBe(1);
      expect(result.distribution[3]).toBe(1);
      expect(result.distribution[2]).toBe(0);
      expect(result.distribution[1]).toBe(0);
    });

    it('should return zero values when no reviews exist', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getRatingSummary('user-1', 'user');

      expect(result.totalReviews).toBe(0);
      expect(result.averageRating).toBe(0);
      expect(result.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    });

    it('should calculate rating summary for a listing', async () => {
      const mockReviews = [{ rating: 5 }, { rating: 4 }];

      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getRatingSummary('listing-1', 'listing');

      expect(result.averageRating).toBe(4.5);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            listingId: 'listing-1',
          }),
        }),
      );
    });
  });

  describe('respondToReview', () => {
    const reviewId = 'review-1';
    const sellerId = 'seller-1';

    it('should allow seller to respond to a review', async () => {
      const mockReview = {
        id: reviewId,
        revieweeId: sellerId,
        status: ReviewStatus.ACTIVE,
        response: null,
      };

      const updatedReview = {
        ...mockReview,
        response: 'Thank you for your feedback!',
        respondedAt: new Date(),
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.review.update.mockResolvedValue(updatedReview);

      const result = await service.respondToReview(reviewId, sellerId, {
        response: 'Thank you for your feedback!',
      });

      expect(result.response).toBe('Thank you for your feedback!');
      expect(mockPrismaService.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: reviewId },
          data: expect.objectContaining({
            response: 'Thank you for your feedback!',
            respondedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw ForbiddenException when user is not the reviewee', async () => {
      const mockReview = {
        id: reviewId,
        revieweeId: 'other-seller',
        status: ReviewStatus.ACTIVE,
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.respondToReview(reviewId, sellerId, { response: 'Thanks!' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when already responded', async () => {
      const mockReview = {
        id: reviewId,
        revieweeId: sellerId,
        status: ReviewStatus.ACTIVE,
        response: 'Already responded',
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.respondToReview(reviewId, sellerId, {
          response: 'Second response',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when review is not active', async () => {
      const mockReview = {
        id: reviewId,
        revieweeId: sellerId,
        status: ReviewStatus.FLAGGED,
        response: null,
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.respondToReview(reviewId, sellerId, { response: 'Thanks!' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('editReview', () => {
    const reviewId = 'review-1';
    const userId = 'user-1';

    it('should edit a review within 24 hours', async () => {
      const recentDate = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const mockReview = {
        id: reviewId,
        reviewerId: userId,
        status: ReviewStatus.ACTIVE,
        createdAt: recentDate,
        rating: 4,
        comment: 'Original comment',
      };

      const updatedReview = {
        ...mockReview,
        rating: 5,
        comment: 'Updated comment',
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.review.update.mockResolvedValue(updatedReview);

      const result = await service.editReview(reviewId, userId, {
        rating: 5,
        comment: 'Updated comment',
      });

      expect(result.rating).toBe(5);
      expect(mockPrismaService.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: reviewId },
          data: { rating: 5, comment: 'Updated comment' },
        }),
      );
    });

    it('should throw ForbiddenException when user is not the reviewer', async () => {
      const mockReview = {
        id: reviewId,
        reviewerId: 'other-user',
        status: ReviewStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.editReview(reviewId, userId, { rating: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when edit window expired (>24 hours)', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const mockReview = {
        id: reviewId,
        reviewerId: userId,
        status: ReviewStatus.ACTIVE,
        createdAt: oldDate,
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.editReview(reviewId, userId, { rating: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should only update provided fields', async () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      const mockReview = {
        id: reviewId,
        reviewerId: userId,
        status: ReviewStatus.ACTIVE,
        createdAt: recentDate,
        rating: 4,
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.review.update.mockResolvedValue(mockReview);

      await service.editReview(reviewId, userId, { comment: 'New comment' });

      expect(mockPrismaService.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { comment: 'New comment' },
        }),
      );
    });
  });

  describe('reportReview', () => {
    it('should flag an active review', async () => {
      const mockReview = {
        id: 'review-1',
        status: ReviewStatus.ACTIVE,
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.review.update.mockResolvedValue({
        ...mockReview,
        status: ReviewStatus.FLAGGED,
      });

      const result = await service.reportReview(
        'review-1',
        'user-1',
        'Inappropriate content',
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.review.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: { status: ReviewStatus.FLAGGED },
      });
    });

    it('should not update status if already flagged', async () => {
      const mockReview = {
        id: 'review-1',
        status: ReviewStatus.FLAGGED,
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      const result = await service.reportReview('review-1', 'user-1', 'Spam');

      expect(result.success).toBe(true);
      expect(mockPrismaService.review.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(
        service.reportReview('review-1', 'user-1', 'Reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getListingReviews', () => {
    it('should return reviews for a specific listing', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          listingId: 'listing-1',
          reviewer: { id: 'user-1', profile: {} },
        },
      ];

      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.getListingReviews('listing-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            listingId: 'listing-1',
            status: ReviewStatus.ACTIVE,
          },
        }),
      );
    });
  });

  describe('getUserReviews', () => {
    it('should return reviews given by a user', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.review.count.mockResolvedValue(0);

      await service.getUserReviews('user-1', 'reviewer', 1, 20);

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewerId: 'user-1',
          }),
        }),
      );
    });

    it('should return reviews received by a user', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.review.count.mockResolvedValue(0);

      await service.getUserReviews('user-1', 'reviewee', 1, 20);

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            revieweeId: 'user-1',
          }),
        }),
      );
    });
  });
});
