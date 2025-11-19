import { Test, TestingModule } from '@nestjs/testing';
import { ReputationService } from './reputation.service';
import { PrismaService } from '~/prisma';
import { NotFoundException } from '@nestjs/common';
import { OrderStatus, BookingStatus, UserStatus } from '@prisma/client';

describe('ReputationService', () => {
  let service: ReputationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    userReputation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    chatThread: {
      findMany: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReputationService>(ReputationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReputation', () => {
    it('should return existing reputation', async () => {
      const userId = 'user-123';
      const mockReputation = {
        userId,
        sellerRating: 4.5,
        totalSales: 10,
        salesVolume: 1000,
        buyerRating: 4.8,
        totalPurchases: 5,
        completionRate: 95,
        avgResponseTime: 25,
        responseRate: 90,
        reliabilityScore: 85,
        trustedSeller: true,
        fastResponder: true,
        topRated: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.userReputation.findUnique.mockResolvedValue(mockReputation);

      const result = await service.getReputation(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.sellerRating).toBe(4.5);
    });

    it('should create reputation if not exists', async () => {
      const userId = 'user-123';
      const mockReputation = {
        userId,
        sellerRating: null,
        totalSales: 0,
        salesVolume: 0,
        buyerRating: null,
        totalPurchases: 0,
        completionRate: 0,
        avgResponseTime: null,
        responseRate: 0,
        reliabilityScore: 50,
        trustedSeller: false,
        fastResponder: false,
        topRated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.userReputation.findUnique.mockResolvedValue(null);
      mockPrismaService.userReputation.create.mockResolvedValue(mockReputation);

      const result = await service.getReputation(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(mockPrismaService.userReputation.create).toHaveBeenCalled();
    });
  });

  describe('calculateReputation', () => {
    it('should calculate reputation with orders and bookings', async () => {
      const userId = 'user-123';
      const mockOrders = [
        {
          id: 'order-1',
          totalPrice: 100,
          reviews: [{ id: 'review-1', rating: 5 }],
        },
        {
          id: 'order-2',
          totalPrice: 200,
          reviews: [{ id: 'review-2', rating: 4 }],
        },
      ];
      const mockBookings = [
        {
          id: 'booking-1',
          totalPrice: 150,
          reviews: [{ id: 'review-3', rating: 5 }],
        },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.booking.findMany.mockResolvedValue(mockBookings);
      mockPrismaService.order.count
        .mockResolvedValueOnce(3) // total orders
        .mockResolvedValueOnce(0); // cancelled orders
      mockPrismaService.chatThread.findMany.mockResolvedValue([]);
      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.userReputation.upsert.mockResolvedValue({
        userId,
        sellerRating: 4.67,
        totalSales: 3,
        salesVolume: 450,
        reliabilityScore: 75,
        trustedSeller: false,
        fastResponder: false,
        topRated: false,
      });

      const result = await service.calculateReputation(userId);

      expect(result).toBeDefined();
      expect(result.totalSales).toBe(3);
      expect(mockPrismaService.userReputation.upsert).toHaveBeenCalled();
    });
  });

  describe('recalculateAllReputations', () => {
    it('should recalculate reputation for all verified users', async () => {
      const mockUsers = [
        { id: 'user-1', status: UserStatus.VERIFIED },
        { id: 'user-2', status: UserStatus.VERIFIED },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);
      mockPrismaService.chatThread.findMany.mockResolvedValue([]);
      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.userReputation.upsert.mockResolvedValue({});

      const result = await service.recalculateAllReputations();

      expect(result).toBe(2);
      expect(mockPrismaService.userReputation.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTopRatedUsers', () => {
    it('should return top-rated users with topRated badge', async () => {
      const mockReputations = [
        {
          userId: 'user-1',
          reliabilityScore: 95,
          topRated: true,
          sellerRating: 4.9,
        },
        {
          userId: 'user-2',
          reliabilityScore: 90,
          topRated: true,
          sellerRating: 4.8,
        },
      ];

      mockPrismaService.userReputation.findMany.mockResolvedValue(mockReputations);

      const result = await service.getTopRatedUsers(10);

      expect(result).toHaveLength(2);
      expect(result[0].topRated).toBe(true);
      expect(mockPrismaService.userReputation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { topRated: true },
          orderBy: { reliabilityScore: 'desc' },
          take: 10,
        }),
      );
    });
  });

  describe('getTrustedSellers', () => {
    it('should return trusted sellers', async () => {
      const mockReputations = [
        {
          userId: 'user-1',
          totalSales: 50,
          trustedSeller: true,
          sellerRating: 4.7,
        },
        {
          userId: 'user-2',
          totalSales: 30,
          trustedSeller: true,
          sellerRating: 4.6,
        },
      ];

      mockPrismaService.userReputation.findMany.mockResolvedValue(mockReputations);

      const result = await service.getTrustedSellers(10);

      expect(result).toHaveLength(2);
      expect(result[0].trustedSeller).toBe(true);
      expect(mockPrismaService.userReputation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trustedSeller: true },
          orderBy: { totalSales: 'desc' },
          take: 10,
        }),
      );
    });
  });
});
