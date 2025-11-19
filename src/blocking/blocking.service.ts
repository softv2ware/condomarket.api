import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { BlockUserDto } from './dto/block-user.dto';
import { BlockedUserEntity } from './entities/blocked-user.entity';

@Injectable()
export class BlockingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Block a user
   */
  async blockUser(blockerId: string, dto: BlockUserDto): Promise<BlockedUserEntity> {
    // Prevent self-blocking
    if (blockerId === dto.blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    // Check if blocked user exists
    const blockedUser = await this.prisma.user.findUnique({
      where: { id: dto.blockedId },
    });

    if (!blockedUser) {
      throw new NotFoundException('User to block not found');
    }

    // Check if already blocked
    const existing = await this.prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: dto.blockedId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User is already blocked');
    }

    // Create block
    const block = await this.prisma.blockedUser.create({
      data: {
        blockerId,
        blockedId: dto.blockedId,
        reason: dto.reason,
      },
    });

    return new BlockedUserEntity(block);
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<{ success: boolean }> {
    const block = await this.prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    await this.prisma.blockedUser.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    return { success: true };
  }

  /**
   * Get all users blocked by a user
   */
  async getBlockedUsers(userId: string): Promise<BlockedUserEntity[]> {
    const blocks = await this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((block) => new BlockedUserEntity(block));
  }

  /**
   * Get all users who blocked a user
   */
  async getBlockers(userId: string): Promise<BlockedUserEntity[]> {
    const blocks = await this.prisma.blockedUser.findMany({
      where: { blockedId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((block) => new BlockedUserEntity(block));
  }

  /**
   * Check if a user is blocked by another user
   */
  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    // Check if userId blocked targetId OR targetId blocked userId
    const block = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId },
        ],
      },
    });

    return !!block;
  }

  /**
   * Check if any blocking relationship exists between two users
   */
  async areUsersBlocked(userId1: string, userId2: string): Promise<{
    isBlocked: boolean;
    blockedBy: string | null;
  }> {
    const block = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId1, blockedId: userId2 },
          { blockerId: userId2, blockedId: userId1 },
        ],
      },
    });

    if (block) {
      return {
        isBlocked: true,
        blockedBy: block.blockerId,
      };
    }

    return {
      isBlocked: false,
      blockedBy: null,
    };
  }
}
