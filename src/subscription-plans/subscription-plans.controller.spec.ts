import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionTier } from '@prisma/client';

describe('SubscriptionPlansController', () => {
  let controller: SubscriptionPlansController;
  let service: SubscriptionPlansService;

  const mockSubscriptionPlansService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByTier: jest.fn(),
    getDefaultFreePlan: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockPlan = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Free Plan',
    tier: SubscriptionTier.FREE,
    description: 'Basic free plan',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionPlansController],
      providers: [
        {
          provide: SubscriptionPlansService,
          useValue: mockSubscriptionPlansService,
        },
      ],
    }).compile();

    controller = module.get<SubscriptionPlansController>(SubscriptionPlansController);
    service = module.get<SubscriptionPlansService>(SubscriptionPlansService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a subscription plan', async () => {
      const createDto = {
        name: 'Free Plan',
        tier: SubscriptionTier.FREE,
        description: 'Basic free plan',
        monthlyPrice: 0,
        maxActiveListings: 1,
        isHighlightEnabled: false,
        sortPriority: 0,
        isDefaultFree: true,
      };

      mockSubscriptionPlansService.create.mockResolvedValue(mockPlan);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockPlan);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should handle validation errors', async () => {
      const createDto = {
        name: 'Invalid Plan',
        tier: SubscriptionTier.PREMIUM,
        description: 'Test',
        monthlyPrice: -10, // Invalid negative price
        maxActiveListings: 10,
        isHighlightEnabled: true,
        sortPriority: 10,
        isDefaultFree: false,
      };

      mockSubscriptionPlansService.create.mockRejectedValue(
        new Error('monthlyPrice must be a positive number'),
      );

      await expect(controller.create(createDto)).rejects.toThrow();
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all subscription plans', async () => {
      const plans = [mockPlan];
      mockSubscriptionPlansService.findAll.mockResolvedValue(plans);

      const result = await controller.findAll();

      expect(result).toEqual(plans);
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should filter plans by buildingId', async () => {
      const buildingId = '123e4567-e89b-12d3-a456-426614174001';
      const plans = [{ ...mockPlan, buildingId }];
      mockSubscriptionPlansService.findAll.mockResolvedValue(plans);

      const result = await controller.findAll(buildingId);

      expect(result).toEqual(plans);
      expect(service.findAll).toHaveBeenCalledWith(buildingId);
    });

    it('should return empty array when no plans exist', async () => {
      mockSubscriptionPlansService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('should return a subscription plan by id', async () => {
      mockSubscriptionPlansService.findOne.mockResolvedValue(mockPlan);

      const result = await controller.findOne(mockPlan.id);

      expect(result).toEqual(mockPlan);
      expect(service.findOne).toHaveBeenCalledWith(mockPlan.id);
    });

    it('should throw NotFoundException when plan not found', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      mockSubscriptionPlansService.findOne.mockRejectedValue(
        new Error('Subscription plan not found'),
      );

      await expect(controller.findOne(nonExistentId)).rejects.toThrow();
      expect(service.findOne).toHaveBeenCalledWith(nonExistentId);
    });
  });

  describe('update', () => {
    it('should update a subscription plan', async () => {
      const updateDto = {
        monthlyPrice: 5.99,
        maxActiveListings: 5,
      };
      const updatedPlan = { ...mockPlan, ...updateDto };

      mockSubscriptionPlansService.update.mockResolvedValue(updatedPlan);

      const result = await controller.update(mockPlan.id, updateDto);

      expect(result).toEqual(updatedPlan);
      expect(service.update).toHaveBeenCalledWith(mockPlan.id, updateDto);
    });

    it('should handle updating isDefaultFree flag', async () => {
      const updateDto = {
        isDefaultFree: true,
      };
      const updatedPlan = { ...mockPlan, ...updateDto };

      mockSubscriptionPlansService.update.mockResolvedValue(updatedPlan);

      const result = await controller.update(mockPlan.id, updateDto);

      expect(result).toEqual(updatedPlan);
      expect(service.update).toHaveBeenCalledWith(mockPlan.id, updateDto);
    });

    it('should throw NotFoundException when updating non-existent plan', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const updateDto = { monthlyPrice: 5.99 };

      mockSubscriptionPlansService.update.mockRejectedValue(
        new Error('Subscription plan not found'),
      );

      await expect(controller.update(nonExistentId, updateDto)).rejects.toThrow();
      expect(service.update).toHaveBeenCalledWith(nonExistentId, updateDto);
    });
  });

  describe('remove', () => {
    it('should soft delete a subscription plan', async () => {
      const deactivatedPlan = { ...mockPlan, isActive: false };
      mockSubscriptionPlansService.remove.mockResolvedValue(deactivatedPlan);

      const result = await controller.remove(mockPlan.id);

      expect(result).toEqual(deactivatedPlan);
      expect(result.isActive).toBe(false);
      expect(service.remove).toHaveBeenCalledWith(mockPlan.id);
    });

    it('should throw NotFoundException when deleting non-existent plan', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      mockSubscriptionPlansService.remove.mockRejectedValue(
        new Error('Subscription plan not found'),
      );

      await expect(controller.remove(nonExistentId)).rejects.toThrow();
      expect(service.remove).toHaveBeenCalledWith(nonExistentId);
    });
  });

  describe('tier validation', () => {
    it('should create FREE tier plan', async () => {
      const createDto = {
        name: 'Free Plan',
        tier: SubscriptionTier.FREE,
        description: 'Free tier',
        monthlyPrice: 0,
        maxActiveListings: 1,
        isHighlightEnabled: false,
        sortPriority: 0,
        isDefaultFree: true,
      };

      mockSubscriptionPlansService.create.mockResolvedValue({
        ...mockPlan,
        tier: SubscriptionTier.FREE,
      });

      const result = await controller.create(createDto);

      expect(result.tier).toBe(SubscriptionTier.FREE);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should create STANDARD tier plan', async () => {
      const createDto = {
        name: 'Standard Plan',
        tier: SubscriptionTier.STANDARD,
        description: 'Standard tier',
        monthlyPrice: 9.99,
        maxActiveListings: 10,
        isHighlightEnabled: false,
        sortPriority: 5,
        isDefaultFree: false,
      };

      mockSubscriptionPlansService.create.mockResolvedValue({
        ...mockPlan,
        tier: SubscriptionTier.STANDARD,
        monthlyPrice: 9.99,
        maxActiveListings: 10,
      });

      const result = await controller.create(createDto);

      expect(result.tier).toBe(SubscriptionTier.STANDARD);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should create PREMIUM tier plan', async () => {
      const createDto = {
        name: 'Premium Plan',
        tier: SubscriptionTier.PREMIUM,
        description: 'Premium tier',
        monthlyPrice: 29.99,
        maxActiveListings: 999999,
        isHighlightEnabled: true,
        sortPriority: 10,
        isDefaultFree: false,
      };

      mockSubscriptionPlansService.create.mockResolvedValue({
        ...mockPlan,
        tier: SubscriptionTier.PREMIUM,
        monthlyPrice: 29.99,
        maxActiveListings: 999999,
        isHighlightEnabled: true,
      });

      const result = await controller.create(createDto);

      expect(result.tier).toBe(SubscriptionTier.PREMIUM);
      expect(result.isHighlightEnabled).toBe(true);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('building-specific plans', () => {
    it('should create a building-specific plan', async () => {
      const buildingId = '123e4567-e89b-12d3-a456-426614174001';
      const createDto = {
        name: 'Building Custom Plan',
        tier: SubscriptionTier.STANDARD,
        description: 'Custom plan for specific building',
        monthlyPrice: 15.99,
        maxActiveListings: 15,
        isHighlightEnabled: false,
        sortPriority: 5,
        isDefaultFree: false,
        buildingId,
      };

      mockSubscriptionPlansService.create.mockResolvedValue({
        ...mockPlan,
        ...createDto,
      });

      const result = await controller.create(createDto);

      expect(result.buildingId).toBe(buildingId);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });
});
