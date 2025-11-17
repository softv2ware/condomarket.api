import { Test, TestingModule } from '@nestjs/testing';
import { SellerSubscriptionsController } from './seller-subscriptions.controller';
import { SellerSubscriptionsService } from './seller-subscriptions.service';
import { SubscriptionTier, SubscriptionStatus, UserRole } from '../prisma/client';

describe('SellerSubscriptionsController', () => {
  let controller: SellerSubscriptionsController;
  let service: SellerSubscriptionsService;

  const mockSellerSubscriptionsService = {
    subscribe: jest.fn(),
    getMySubscriptions: jest.fn(),
    findOne: jest.fn(),
    changePlan: jest.fn(),
    cancel: jest.fn(),
    canCreateListing: jest.fn(),
    findAll: jest.fn(),
    getSubscriptionStats: jest.fn(),
    overrideSubscription: jest.fn(),
  };

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'user@example.com',
    role: UserRole.RESIDENT,
  };

  const mockPlan = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Free Plan',
    tier: SubscriptionTier.FREE,
    monthlyPrice: 0,
    maxActiveListings: 1,
    isHighlightEnabled: false,
    sortPriority: 0,
    isDefaultFree: true,
    isActive: true,
    buildingId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBuilding = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Sunset Towers',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'USA',
  };

  const mockSubscription = {
    id: '123e4567-e89b-12d3-a456-426614174003',
    userId: mockUser.id,
    buildingId: mockBuilding.id,
    planId: mockPlan.id,
    status: SubscriptionStatus.ACTIVE,
    startDate: new Date(),
    endDate: null,
    renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastPaymentStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: mockPlan,
    building: mockBuilding,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SellerSubscriptionsController],
      providers: [
        {
          provide: SellerSubscriptionsService,
          useValue: mockSellerSubscriptionsService,
        },
      ],
    }).compile();

    controller = module.get<SellerSubscriptionsController>(SellerSubscriptionsController);
    service = module.get<SellerSubscriptionsService>(SellerSubscriptionsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create (subscribe)', () => {
    it('should subscribe user to a plan', async () => {
      const createDto = {
        subscriptionPlanId: mockPlan.id,
        buildingId: mockBuilding.id,
      };

      mockSellerSubscriptionsService.subscribe.mockResolvedValue(mockSubscription);

      const result = await controller.create(mockUser.id, createDto);

      expect(result).toEqual(mockSubscription);
      expect(service.subscribe).toHaveBeenCalledWith(mockUser.id, createDto);
    });

    it('should throw ConflictException when user already has subscription', async () => {
      const createDto = {
        subscriptionPlanId: mockPlan.id,
        buildingId: mockBuilding.id,
      };

      mockSellerSubscriptionsService.subscribe.mockRejectedValue(
        new Error('You already have an active subscription for this building'),
      );

      await expect(controller.create(mockUser.id, createDto)).rejects.toThrow();
      expect(service.subscribe).toHaveBeenCalledWith(mockUser.id, createDto);
    });

    it('should throw NotFoundException when plan does not exist', async () => {
      const createDto = {
        subscriptionPlanId: '123e4567-e89b-12d3-a456-426614174999',
        buildingId: mockBuilding.id,
      };

      mockSellerSubscriptionsService.subscribe.mockRejectedValue(
        new Error('Subscription plan not found'),
      );

      await expect(controller.create(mockUser.id, createDto)).rejects.toThrow();
      expect(service.subscribe).toHaveBeenCalledWith(mockUser.id, createDto);
    });

    it('should throw BadRequestException when plan is inactive', async () => {
      const createDto = {
        subscriptionPlanId: mockPlan.id,
        buildingId: mockBuilding.id,
      };

      mockSellerSubscriptionsService.subscribe.mockRejectedValue(
        new Error('This subscription plan is not available'),
      );

      await expect(controller.create(mockUser.id, createDto)).rejects.toThrow();
      expect(service.subscribe).toHaveBeenCalledWith(mockUser.id, createDto);
    });
  });

  describe('getMySubscriptions', () => {
    it('should return all subscriptions for the user', async () => {
      const subscriptions = [mockSubscription];
      mockSellerSubscriptionsService.getMySubscriptions.mockResolvedValue(subscriptions);

      const result = await controller.getMySubscriptions(mockUser.id);

      expect(result).toEqual(subscriptions);
      expect(service.getMySubscriptions).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return empty array when user has no subscriptions', async () => {
      mockSellerSubscriptionsService.getMySubscriptions.mockResolvedValue([]);

      const result = await controller.getMySubscriptions(mockUser.id);

      expect(result).toEqual([]);
      expect(service.getMySubscriptions).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return multiple subscriptions for different buildings', async () => {
      const subscriptions = [
        mockSubscription,
        { ...mockSubscription, id: 'sub2', buildingId: 'building2' },
      ];
      mockSellerSubscriptionsService.getMySubscriptions.mockResolvedValue(subscriptions);

      const result = await controller.getMySubscriptions(mockUser.id);

      expect(result).toHaveLength(2);
      expect(service.getMySubscriptions).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('findOne', () => {
    it('should return a subscription by id for the owner', async () => {
      mockSellerSubscriptionsService.findOne.mockResolvedValue(mockSubscription);

      const result = await controller.findOne(mockSubscription.id, mockUser.id);

      expect(result).toEqual(mockSubscription);
      expect(service.findOne).toHaveBeenCalledWith(mockSubscription.id, mockUser.id);
    });

    it('should throw NotFoundException when subscription does not exist', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      mockSellerSubscriptionsService.findOne.mockRejectedValue(
        new Error('Subscription not found'),
      );

      await expect(controller.findOne(nonExistentId, mockUser.id)).rejects.toThrow();
      expect(service.findOne).toHaveBeenCalledWith(nonExistentId, mockUser.id);
    });

    it('should throw NotFoundException when user tries to access another users subscription', async () => {
      const otherUserId = '123e4567-e89b-12d3-a456-426614174999';
      mockSellerSubscriptionsService.findOne.mockRejectedValue(
        new Error('Subscription not found'),
      );

      await expect(controller.findOne(mockSubscription.id, otherUserId)).rejects.toThrow();
      expect(service.findOne).toHaveBeenCalledWith(mockSubscription.id, otherUserId);
    });
  });

  describe('changePlan', () => {
    it('should upgrade subscription plan', async () => {
      const newPlan = {
        ...mockPlan,
        id: 'premium-plan-id',
        tier: SubscriptionTier.PREMIUM,
        monthlyPrice: 29.99,
        maxActiveListings: 999999,
      };
      const changePlanDto = { newPlanId: newPlan.id };
      const updatedSubscription = {
        ...mockSubscription,
        planId: newPlan.id,
        plan: newPlan,
      };

      mockSellerSubscriptionsService.changePlan.mockResolvedValue(updatedSubscription);

      const result = await controller.changePlan(mockSubscription.id, mockUser.id, changePlanDto);

      expect(result).toEqual(updatedSubscription);
      expect(result.plan.tier).toBe(SubscriptionTier.PREMIUM);
      expect(service.changePlan).toHaveBeenCalledWith(
        mockSubscription.id,
        mockUser.id,
        changePlanDto,
      );
    });

    it('should downgrade subscription plan', async () => {
      const premiumSubscription = {
        ...mockSubscription,
        plan: {
          ...mockPlan,
          tier: SubscriptionTier.PREMIUM,
          monthlyPrice: 29.99,
        },
      };
      const changePlanDto = { newPlanId: mockPlan.id };
      const downgradedSubscription = {
        ...premiumSubscription,
        planId: mockPlan.id,
        plan: mockPlan,
      };

      mockSellerSubscriptionsService.changePlan.mockResolvedValue(downgradedSubscription);

      const result = await controller.changePlan(
        premiumSubscription.id,
        mockUser.id,
        changePlanDto,
      );

      expect(result).toEqual(downgradedSubscription);
      expect(result.plan.tier).toBe(SubscriptionTier.FREE);
      expect(service.changePlan).toHaveBeenCalledWith(
        premiumSubscription.id,
        mockUser.id,
        changePlanDto,
      );
    });

    it('should throw BadRequestException when changing to same plan', async () => {
      const changePlanDto = { newPlanId: mockPlan.id };

      mockSellerSubscriptionsService.changePlan.mockRejectedValue(
        new Error('You are already on this plan'),
      );

      await expect(
        controller.changePlan(mockSubscription.id, mockUser.id, changePlanDto),
      ).rejects.toThrow();
      expect(service.changePlan).toHaveBeenCalledWith(
        mockSubscription.id,
        mockUser.id,
        changePlanDto,
      );
    });

    it('should throw BadRequestException when subscription is not active', async () => {
      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
      };
      const changePlanDto = { newPlanId: 'new-plan-id' };

      mockSellerSubscriptionsService.changePlan.mockRejectedValue(
        new Error('Can only change plan for active subscriptions'),
      );

      await expect(
        controller.changePlan(cancelledSubscription.id, mockUser.id, changePlanDto),
      ).rejects.toThrow();
    });
  });

  describe('cancel', () => {
    it('should cancel an active subscription', async () => {
      const cancelDto = { reason: 'No longer needed' };
      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        endDate: new Date(),
      };

      mockSellerSubscriptionsService.cancel.mockResolvedValue(cancelledSubscription);

      const result = await controller.cancel(mockSubscription.id, mockUser.id, cancelDto);

      expect(result).toEqual(cancelledSubscription);
      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(service.cancel).toHaveBeenCalledWith(mockSubscription.id, mockUser.id, cancelDto);
    });

    it('should cancel subscription without reason', async () => {
      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        endDate: new Date(),
      };

      mockSellerSubscriptionsService.cancel.mockResolvedValue(cancelledSubscription);

      const result = await controller.cancel(mockSubscription.id, mockUser.id);

      expect(result).toEqual(cancelledSubscription);
      expect(service.cancel).toHaveBeenCalledWith(mockSubscription.id, mockUser.id, undefined);
    });

    it('should throw BadRequestException when cancelling already cancelled subscription', async () => {
      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
      };

      mockSellerSubscriptionsService.cancel.mockRejectedValue(
        new Error('Subscription is already cancelled'),
      );

      await expect(
        controller.cancel(cancelledSubscription.id, mockUser.id),
      ).rejects.toThrow();
    });
  });

  describe('canCreateListing', () => {
    it('should return true when user can create listing', async () => {
      const response = {
        canCreate: true,
        maxListings: 1,
        currentListings: 0,
        remainingSlots: 1,
        subscriptionPlan: 'Free Plan',
        subscriptionTier: SubscriptionTier.FREE,
      };

      mockSellerSubscriptionsService.canCreateListing.mockResolvedValue(response);

      const result = await controller.canCreateListing(mockUser.id, mockBuilding.id);

      expect(result).toEqual(response);
      expect(result.canCreate).toBe(true);
      expect(result.remainingSlots).toBe(1);
      expect(service.canCreateListing).toHaveBeenCalledWith(mockUser.id, mockBuilding.id);
    });

    it('should return false when listing limit reached', async () => {
      const response = {
        canCreate: false,
        maxListings: 1,
        currentListings: 1,
        remainingSlots: 0,
        subscriptionPlan: 'Free Plan',
        subscriptionTier: SubscriptionTier.FREE,
      };

      mockSellerSubscriptionsService.canCreateListing.mockResolvedValue(response);

      const result = await controller.canCreateListing(mockUser.id, mockBuilding.id);

      expect(result).toEqual(response);
      expect(result.canCreate).toBe(false);
      expect(result.remainingSlots).toBe(0);
      expect(service.canCreateListing).toHaveBeenCalledWith(mockUser.id, mockBuilding.id);
    });

    it('should return false when no active subscription', async () => {
      const response = {
        canCreate: false,
        reason: 'No active subscription found for this building',
        maxListings: 0,
        currentListings: 0,
        remainingSlots: 0,
      };

      mockSellerSubscriptionsService.canCreateListing.mockResolvedValue(response);

      const result = await controller.canCreateListing(mockUser.id, mockBuilding.id);

      expect(result).toEqual(response);
      expect(result.canCreate).toBe(false);
      expect(result.reason).toBeDefined();
      expect(service.canCreateListing).toHaveBeenCalledWith(mockUser.id, mockBuilding.id);
    });

    it('should show correct slots for PREMIUM plan', async () => {
      const response = {
        canCreate: true,
        maxListings: 999999,
        currentListings: 50,
        remainingSlots: 999949,
        subscriptionPlan: 'Premium Plan',
        subscriptionTier: SubscriptionTier.PREMIUM,
      };

      mockSellerSubscriptionsService.canCreateListing.mockResolvedValue(response);

      const result = await controller.canCreateListing(mockUser.id, mockBuilding.id);

      expect(result).toEqual(response);
      expect(result.maxListings).toBe(999999);
      expect(service.canCreateListing).toHaveBeenCalledWith(mockUser.id, mockBuilding.id);
    });
  });

  describe('findAll (admin)', () => {
    it('should return all subscriptions for admin', async () => {
      const subscriptions = [mockSubscription];
      mockSellerSubscriptionsService.findAll.mockResolvedValue(subscriptions);

      const result = await controller.findAll();

      expect(result).toEqual(subscriptions);
      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should filter subscriptions by buildingId', async () => {
      const subscriptions = [mockSubscription];
      mockSellerSubscriptionsService.findAll.mockResolvedValue(subscriptions);

      const result = await controller.findAll(mockBuilding.id);

      expect(result).toEqual(subscriptions);
      expect(service.findAll).toHaveBeenCalledWith(mockBuilding.id, undefined);
    });

    it('should filter subscriptions by status', async () => {
      const subscriptions = [mockSubscription];
      mockSellerSubscriptionsService.findAll.mockResolvedValue(subscriptions);

      const result = await controller.findAll(undefined, SubscriptionStatus.ACTIVE);

      expect(result).toEqual(subscriptions);
      expect(service.findAll).toHaveBeenCalledWith(undefined, SubscriptionStatus.ACTIVE);
    });

    it('should filter by both buildingId and status', async () => {
      const subscriptions = [mockSubscription];
      mockSellerSubscriptionsService.findAll.mockResolvedValue(subscriptions);

      const result = await controller.findAll(mockBuilding.id, SubscriptionStatus.ACTIVE);

      expect(result).toEqual(subscriptions);
      expect(service.findAll).toHaveBeenCalledWith(mockBuilding.id, SubscriptionStatus.ACTIVE);
    });
  });

  describe('getStats (admin)', () => {
    it('should return subscription statistics', async () => {
      const stats = {
        totalActiveSubscriptions: 100,
        byStatus: [
          { status: SubscriptionStatus.ACTIVE, _count: 80 },
          { status: SubscriptionStatus.GRACE_PERIOD, _count: 20 },
        ],
        byTier: {
          FREE: { count: 60, revenue: 0 },
          STANDARD: { count: 30, revenue: 299.7 },
          PREMIUM: { count: 10, revenue: 299.9 },
        },
        totalMonthlyRevenue: 599.6,
        buildingId: 'all',
      };

      mockSellerSubscriptionsService.getSubscriptionStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(result).toEqual(stats);
      expect(result.totalActiveSubscriptions).toBe(100);
      expect(result.totalMonthlyRevenue).toBe(599.6);
      expect(service.getSubscriptionStats).toHaveBeenCalledWith(undefined);
    });

    it('should return statistics for specific building', async () => {
      const stats = {
        totalActiveSubscriptions: 50,
        byStatus: [{ status: SubscriptionStatus.ACTIVE, _count: 50 }],
        byTier: {
          FREE: { count: 30, revenue: 0 },
          STANDARD: { count: 15, revenue: 149.85 },
          PREMIUM: { count: 5, revenue: 149.95 },
        },
        totalMonthlyRevenue: 299.8,
        buildingId: mockBuilding.id,
      };

      mockSellerSubscriptionsService.getSubscriptionStats.mockResolvedValue(stats);

      const result = await controller.getStats(mockBuilding.id);

      expect(result).toEqual(stats);
      expect(result.buildingId).toBe(mockBuilding.id);
      expect(service.getSubscriptionStats).toHaveBeenCalledWith(mockBuilding.id);
    });
  });

  describe('overrideSubscription (admin)', () => {
    it('should allow admin to override subscription status', async () => {
      const overrideDto = {
        status: SubscriptionStatus.ACTIVE,
        reason: 'Customer service exception',
      };
      const overriddenSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      };

      mockSellerSubscriptionsService.overrideSubscription.mockResolvedValue(
        overriddenSubscription,
      );

      const result = await controller.overrideSubscription(mockSubscription.id, overrideDto);

      expect(result).toEqual(overriddenSubscription);
      expect(service.overrideSubscription).toHaveBeenCalledWith(
        mockSubscription.id,
        overrideDto.status,
        overrideDto.reason,
      );
    });

    it('should allow admin to force cancel subscription', async () => {
      const overrideDto = {
        status: SubscriptionStatus.CANCELLED,
        reason: 'Policy violation',
      };
      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        endDate: new Date(),
      };

      mockSellerSubscriptionsService.overrideSubscription.mockResolvedValue(
        cancelledSubscription,
      );

      const result = await controller.overrideSubscription(mockSubscription.id, overrideDto);

      expect(result).toEqual(cancelledSubscription);
      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(service.overrideSubscription).toHaveBeenCalledWith(
        mockSubscription.id,
        overrideDto.status,
        overrideDto.reason,
      );
    });

    it('should throw NotFoundException when subscription does not exist', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const overrideDto = {
        status: SubscriptionStatus.ACTIVE,
        reason: 'Test',
      };

      mockSellerSubscriptionsService.overrideSubscription.mockRejectedValue(
        new Error('Subscription not found'),
      );

      await expect(controller.overrideSubscription(nonExistentId, overrideDto)).rejects.toThrow();
      expect(service.overrideSubscription).toHaveBeenCalledWith(
        nonExistentId,
        overrideDto.status,
        overrideDto.reason,
      );
    });
  });

  describe('lifecycle status transitions', () => {
    it('should handle ACTIVE to GRACE_PERIOD transition', async () => {
      const gracePeriodSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.GRACE_PERIOD,
      };

      mockSellerSubscriptionsService.findOne.mockResolvedValue(gracePeriodSubscription);

      const result = await controller.findOne(mockSubscription.id, mockUser.id);

      expect(result.status).toBe(SubscriptionStatus.GRACE_PERIOD);
    });

    it('should handle GRACE_PERIOD to EXPIRED transition', async () => {
      const expiredSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.EXPIRED,
        endDate: new Date(),
      };

      mockSellerSubscriptionsService.findOne.mockResolvedValue(expiredSubscription);

      const result = await controller.findOne(mockSubscription.id, mockUser.id);

      expect(result.status).toBe(SubscriptionStatus.EXPIRED);
      expect(result.endDate).toBeDefined();
    });

    it('should handle ACTIVE to CANCELLED transition', async () => {
      const cancelDto = { reason: 'Test cancellation' };
      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        endDate: new Date(),
      };

      mockSellerSubscriptionsService.cancel.mockResolvedValue(cancelledSubscription);

      const result = await controller.cancel(mockSubscription.id, mockUser.id, cancelDto);

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(result.endDate).toBeDefined();
    });
  });
});
