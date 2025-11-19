import { Test, TestingModule } from '@nestjs/testing';
import { BlockingService } from './blocking.service';
import { PrismaService } from '~/prisma';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('BlockingService', () => {
  let service: BlockingService;

  const mockPrismaService = {
    blockedUser: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BlockingService>(BlockingService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('blockUser', () => {
    const blockUserDto = {
      blockedId: 'user-456',
      reason: 'Harassment',
    };

    it('should block a user successfully', async () => {
      const blockerId = 'user-123';
      const mockUser = { id: 'user-456' };
      const mockBlock = {
        id: 'block-123',
        blockerId,
        blockedId: 'user-456',
        reason: 'Harassment',
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.blockedUser.findUnique.mockResolvedValue(null);
      mockPrismaService.blockedUser.create.mockResolvedValue(mockBlock);

      const result = await service.blockUser(blockerId, blockUserDto);

      expect(result).toBeDefined();
      expect(result.blockerId).toBe(blockerId);
      expect(result.blockedId).toBe('user-456');
      expect(mockPrismaService.blockedUser.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to block self', async () => {
      const userId = 'user-123';
      const dto = { blockedId: userId };

      await expect(service.blockUser(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      const blockerId = 'user-123';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.blockUser(blockerId, blockUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for duplicate block', async () => {
      const blockerId = 'user-123';
      const existingBlock = { id: 'block-123' };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-456' });
      mockPrismaService.blockedUser.findUnique.mockResolvedValue(existingBlock);

      await expect(service.blockUser(blockerId, blockUserDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unblockUser', () => {
    it('should unblock a user successfully', async () => {
      const blockerId = 'user-123';
      const blockedId = 'user-456';
      const mockBlock = {
        id: 'block-123',
        blockerId,
        blockedId,
      };

      mockPrismaService.blockedUser.findUnique.mockResolvedValue(mockBlock);
      mockPrismaService.blockedUser.delete.mockResolvedValue(mockBlock);

      const result = await service.unblockUser(blockerId, blockedId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockPrismaService.blockedUser.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent block', async () => {
      mockPrismaService.blockedUser.findUnique.mockResolvedValue(null);

      await expect(service.unblockUser('user-123', 'user-456')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getBlockedUsers', () => {
    it('should return list of blocked users', async () => {
      const userId = 'user-123';
      const mockBlocks = [
        {
          id: 'block-1',
          blockerId: userId,
          blockedId: 'user-456',
          createdAt: new Date(),
        },
        {
          id: 'block-2',
          blockerId: userId,
          blockedId: 'user-789',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.blockedUser.findMany.mockResolvedValue(mockBlocks);

      const result = await service.getBlockedUsers(userId);

      expect(result).toHaveLength(2);
      expect(result[0].blockerId).toBe(userId);
    });
  });

  describe('getBlockers', () => {
    it('should return list of users who blocked this user', async () => {
      const userId = 'user-123';
      const mockBlocks = [
        {
          id: 'block-1',
          blockerId: 'user-456',
          blockedId: userId,
          createdAt: new Date(),
        },
        {
          id: 'block-2',
          blockerId: 'user-789',
          blockedId: userId,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.blockedUser.findMany.mockResolvedValue(mockBlocks);

      const result = await service.getBlockers(userId);

      expect(result).toHaveLength(2);
      expect(result[0].blockedId).toBe(userId);
    });
  });

  describe('isBlocked', () => {
    it('should return true when users are blocked', async () => {
      const mockBlock = {
        id: 'block-123',
        blockerId: 'user-123',
        blockedId: 'user-456',
      };

      mockPrismaService.blockedUser.findFirst.mockResolvedValue(mockBlock);

      const result = await service.isBlocked('user-123', 'user-456');

      expect(result).toBe(true);
    });

    it('should return false when users are not blocked', async () => {
      mockPrismaService.blockedUser.findFirst.mockResolvedValue(null);

      const result = await service.isBlocked('user-123', 'user-456');

      expect(result).toBe(false);
    });
  });

  describe('areUsersBlocked', () => {
    it('should return block information when blocked', async () => {
      const mockBlock = {
        id: 'block-123',
        blockerId: 'user-123',
        blockedId: 'user-456',
      };

      mockPrismaService.blockedUser.findFirst.mockResolvedValue(mockBlock);

      const result = await service.areUsersBlocked('user-123', 'user-456');

      expect(result.isBlocked).toBe(true);
      expect(result.blockedBy).toBe('user-123');
    });

    it('should return no block information when not blocked', async () => {
      mockPrismaService.blockedUser.findFirst.mockResolvedValue(null);

      const result = await service.areUsersBlocked('user-123', 'user-456');

      expect(result.isBlocked).toBe(false);
      expect(result.blockedBy).toBeNull();
    });
  });
});
