import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { PrismaService } from '~/prisma';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ModerationStatus, UserStatus, ListingStatus } from '@prisma/client';

describe('ModerationService', () => {
  let service: ModerationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    moderationAction: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    listing: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAction', () => {
    const createActionDto = {
      targetType: 'user' as const,
      targetId: 'user-123',
      actionType: 'WARNING' as const,
      reason: 'Inappropriate behavior',
      buildingId: 'building-123',
    };

    it('should create moderation action successfully', async () => {
      const moderatorId = 'admin-123';
      const mockUser = { id: 'user-123', status: UserStatus.VERIFIED };
      const mockAction = {
        id: 'action-123',
        ...createActionDto,
        moderatorId,
        status: ModerationStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.moderationAction.findFirst.mockResolvedValue(null);
      mockPrismaService.moderationAction.create.mockResolvedValue(mockAction);

      const result = await service.createAction(moderatorId, createActionDto);

      expect(result).toBeDefined();
      expect(result.targetId).toBe('user-123');
      expect(mockPrismaService.moderationAction.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid target', async () => {
      const moderatorId = 'admin-123';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.createAction(moderatorId, createActionDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for duplicate active action', async () => {
      const moderatorId = 'admin-123';
      const mockUser = { id: 'user-123', status: UserStatus.VERIFIED };
      const existingAction = {
        id: 'action-123',
        status: ModerationStatus.ACTIVE,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.moderationAction.findFirst.mockResolvedValue(existingAction);

      await expect(service.createAction(moderatorId, createActionDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('warnUser', () => {
    it('should create warning action', async () => {
      const moderatorId = 'admin-123';
      const userId = 'user-123';
      const mockUser = { id: userId, status: UserStatus.VERIFIED };
      const mockAction = {
        id: 'action-123',
        targetType: 'user',
        targetId: userId,
        actionType: 'WARNING',
        status: ModerationStatus.ACTIVE,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.moderationAction.findFirst.mockResolvedValue(null);
      mockPrismaService.moderationAction.create.mockResolvedValue(mockAction);

      const result = await service.warnUser(moderatorId, userId, 'Inappropriate behavior', 'building-123');

      expect(result).toBeDefined();
      expect(result.actionType).toBe('WARNING');
    });
  });

  describe('suspendUser', () => {
    it('should suspend user successfully', async () => {
      const moderatorId = 'admin-123';
      const userId = 'user-123';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const mockUser = { id: userId, status: UserStatus.VERIFIED };
      const mockAction = {
        id: 'action-123',
        targetType: 'user',
        targetId: userId,
        actionType: 'SUSPENSION',
        status: ModerationStatus.ACTIVE,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.moderationAction.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, status: UserStatus.SUSPENDED });
      mockPrismaService.moderationAction.create.mockResolvedValue(mockAction);

      const result = await service.suspendUser(
        moderatorId,
        userId,
        expiresAt.toISOString(),
        'Spam',
        'building-123',
      );

      expect(result).toBeDefined();
      expect(result.actionType).toBe('SUSPENSION');
      expect(mockPrismaService.moderationAction.create).toHaveBeenCalled();
    });
  });

  describe('banUser', () => {
    it('should ban user permanently', async () => {
      const moderatorId = 'admin-123';
      const userId = 'user-123';
      const mockUser = { id: userId, status: UserStatus.VERIFIED };
      const mockAction = {
        id: 'action-123',
        targetType: 'user',
        targetId: userId,
        actionType: 'BAN',
        status: ModerationStatus.ACTIVE,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.moderationAction.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, status: UserStatus.BANNED });
      mockPrismaService.moderationAction.create.mockResolvedValue(mockAction);

      const result = await service.banUser(moderatorId, userId, 'Severe violation');

      expect(result).toBeDefined();
      expect(result.actionType).toBe('BAN');
      expect(mockPrismaService.moderationAction.create).toHaveBeenCalled();
    });
  });

  describe('removeContent', () => {
    it('should remove listing content', async () => {
      const moderatorId = 'admin-123';
      const listingId = 'listing-123';
      const mockListing = { id: listingId, status: ListingStatus.ACTIVE };
      const mockAction = {
        id: 'action-123',
        targetType: 'listing',
        targetId: listingId,
        actionType: 'CONTENT_REMOVAL',
        status: ModerationStatus.ACTIVE,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.moderationAction.findFirst.mockResolvedValue(null);
      mockPrismaService.listing.update.mockResolvedValue({ ...mockListing, status: ListingStatus.REJECTED });
      mockPrismaService.moderationAction.create.mockResolvedValue(mockAction);

      const result = await service.removeContent(
        moderatorId,
        'listing',
        listingId,
        'Inappropriate content',
        'building-123',
      );

      expect(result).toBeDefined();
      expect(result.actionType).toBe('CONTENT_REMOVAL');
    });
  });

  describe('revokeAction', () => {
    it('should revoke active moderation action', async () => {
      const actionId = 'action-123';
      const moderatorId = 'admin-123';
      const mockAction = {
        id: actionId,
        status: ModerationStatus.ACTIVE,
        targetType: 'user',
        targetId: 'user-123',
        actionType: 'SUSPENSION',
      };
      const mockUser = { id: 'user-123', status: UserStatus.SUSPENDED };

      mockPrismaService.moderationAction.findUnique.mockResolvedValue(mockAction);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, status: UserStatus.VERIFIED });
      mockPrismaService.moderationAction.update.mockResolvedValue({
        ...mockAction,
        status: ModerationStatus.REVOKED,
      });

      const result = await service.revokeAction(actionId, moderatorId, { reason: 'Appealed successfully' });

      expect(result).toBeDefined();
      expect(result.status).toBe(ModerationStatus.REVOKED);
    });

    it('should throw NotFoundException for non-existent action', async () => {
      mockPrismaService.moderationAction.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeAction('action-123', 'admin-123', { reason: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('hasActiveRestrictions', () => {
    it('should return true when user has active restrictions', async () => {
      const userId = 'user-123';

      mockPrismaService.moderationAction.count.mockResolvedValue(1);

      const result = await service.hasActiveRestrictions(userId);

      expect(result).toBe(true);
    });

    it('should return false when user has no active restrictions', async () => {
      const userId = 'user-123';

      mockPrismaService.moderationAction.count.mockResolvedValue(0);

      const result = await service.hasActiveRestrictions(userId);

      expect(result).toBe(false);
    });
  });

  describe('processExpiredActions', () => {
    it('should process and expire outdated actions', async () => {
      const mockActions = [
        {
          id: 'action-1',
          targetType: 'user',
          targetId: 'user-123',
          actionType: 'SUSPENSION',
          status: ModerationStatus.ACTIVE,
        },
        {
          id: 'action-2',
          targetType: 'user',
          targetId: 'user-456',
          actionType: 'RESTRICTION',
          status: ModerationStatus.ACTIVE,
        },
      ];

      mockPrismaService.moderationAction.findMany.mockResolvedValue(mockActions);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-123', status: UserStatus.SUSPENDED });
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-123', status: UserStatus.VERIFIED });
      mockPrismaService.moderationAction.update.mockResolvedValue({});

      const result = await service.processExpiredActions();

      expect(result).toBe(2);
      expect(mockPrismaService.moderationAction.update).toHaveBeenCalledTimes(2);
    });
  });
});
