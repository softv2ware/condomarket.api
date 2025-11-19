import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { CreateModerationActionDto } from './dto/create-moderation-action.dto';
import { GetModerationActionsDto } from './dto/get-moderation-actions.dto';
import { RevokeModerationDto } from './dto/revoke-moderation.dto';
import { ModerationActionEntity } from './entities/moderation-action.entity';
import {
  ModerationType,
  ModerationStatus,
  UserStatus,
  Prisma,
  ModerationAction,
} from '@prisma/client';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a moderation action
   */
  async createAction(
    moderatorId: string,
    dto: CreateModerationActionDto,
  ): Promise<ModerationActionEntity> {
    // Validate target exists
    await this.validateTarget(dto.targetType, dto.targetId);

    // Check for active moderation actions of same type
    const existingAction = await this.prisma.moderationAction.findFirst({
      where: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        actionType: dto.actionType,
        status: ModerationStatus.ACTIVE,
      },
    });

    if (existingAction) {
      throw new BadRequestException(
        `An active ${dto.actionType} action already exists for this ${dto.targetType}`,
      );
    }

    // Create the moderation action
    const action = await this.prisma.moderationAction.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        actionType: dto.actionType,
        performedBy: moderatorId,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        buildingId: dto.buildingId,
        metadata: dto.metadata || {},
      },
    });

    // Apply the moderation action
    await this.applyModerationAction(action);

    return new ModerationActionEntity(action);
  }

  /**
   * Warn a user
   */
  async warnUser(
    moderatorId: string,
    userId: string,
    reason: string,
    buildingId?: string,
  ): Promise<ModerationActionEntity> {
    return this.createAction(moderatorId, {
      targetType: 'User',
      targetId: userId,
      actionType: ModerationType.WARNING,
      reason,
      buildingId,
    });
  }

  /**
   * Restrict a user's actions
   */
  async restrictUser(
    moderatorId: string,
    userId: string,
    reason: string,
    expiresAt?: string,
    restrictions?: string[],
    buildingId?: string,
  ): Promise<ModerationActionEntity> {
    return this.createAction(moderatorId, {
      targetType: 'User',
      targetId: userId,
      actionType: ModerationType.RESTRICTION,
      reason,
      expiresAt,
      buildingId,
      metadata: {
        restrictions: restrictions || ['create_listings', 'send_messages'],
      },
    });
  }

  /**
   * Suspend a user
   */
  async suspendUser(
    moderatorId: string,
    userId: string,
    reason: string,
    expiresAt: string,
    buildingId?: string,
  ): Promise<ModerationActionEntity> {
    return this.createAction(moderatorId, {
      targetType: 'User',
      targetId: userId,
      actionType: ModerationType.SUSPENSION,
      reason,
      expiresAt,
      buildingId,
    });
  }

  /**
   * Ban a user (Platform Admin only)
   */
  async banUser(
    moderatorId: string,
    userId: string,
    reason: string,
  ): Promise<ModerationActionEntity> {
    return this.createAction(moderatorId, {
      targetType: 'User',
      targetId: userId,
      actionType: ModerationType.BAN,
      reason,
    });
  }

  /**
   * Remove content (listing, review, message)
   */
  async removeContent(
    moderatorId: string,
    entityType: string,
    entityId: string,
    reason: string,
    buildingId?: string,
  ): Promise<ModerationActionEntity> {
    return this.createAction(moderatorId, {
      targetType: entityType,
      targetId: entityId,
      actionType: ModerationType.CONTENT_REMOVAL,
      reason,
      buildingId,
    });
  }

  /**
   * Get moderation actions with filters
   */
  async getActions(dto: GetModerationActionsDto) {
    const {
      targetType,
      targetId,
      actionType,
      status,
      buildingId,
      page = 1,
      limit = 20,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ModerationActionWhereInput = {};

    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (actionType) where.actionType = actionType;
    if (status) where.status = status;
    if (buildingId) where.buildingId = buildingId;

    const [actions, total] = await Promise.all([
      this.prisma.moderationAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          moderator: {
            select: {
              id: true,
              email: true,
              role: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.moderationAction.count({ where }),
    ]);

    return {
      actions: actions.map((a) => new ModerationActionEntity(a)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get moderation history for a specific target
   */
  async getHistory(targetType: string, targetId: string) {
    const actions = await this.prisma.moderationAction.findMany({
      where: {
        targetType,
        targetId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        moderator: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return actions.map((a) => new ModerationActionEntity(a));
  }

  /**
   * Revoke a moderation action
   */
  async revokeAction(
    actionId: string,
    revokedBy: string,
    dto: RevokeModerationDto,
  ): Promise<ModerationActionEntity> {
    const action = await this.prisma.moderationAction.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      throw new NotFoundException('Moderation action not found');
    }

    if (action.status !== ModerationStatus.ACTIVE) {
      throw new BadRequestException(
        'Only active moderation actions can be revoked',
      );
    }

    // Update action status
    const updated = await this.prisma.moderationAction.update({
      where: { id: actionId },
      data: {
        status: ModerationStatus.REVOKED,
        revokedAt: new Date(),
        revokedBy,
        metadata: {
          ...(action.metadata as object),
          revocationReason: dto.reason,
        },
      },
    });

    // Revert the moderation action
    await this.revertModerationAction(updated);

    return new ModerationActionEntity(updated);
  }

  /**
   * Check if user has active restrictions
   */
  async hasActiveRestrictions(userId: string): Promise<boolean> {
    const count = await this.prisma.moderationAction.count({
      where: {
        targetType: 'User',
        targetId: userId,
        actionType: {
          in: [
            ModerationType.RESTRICTION,
            ModerationType.SUSPENSION,
            ModerationType.BAN,
          ],
        },
        status: ModerationStatus.ACTIVE,
        OR: [
          { expiresAt: null }, // Permanent
          { expiresAt: { gt: new Date() } }, // Not expired
        ],
      },
    });

    return count > 0;
  }

  /**
   * Check if user can perform specific action
   */
  async canPerformAction(userId: string, action: string): Promise<boolean> {
    const restrictions = await this.prisma.moderationAction.findMany({
      where: {
        targetType: 'User',
        targetId: userId,
        actionType: ModerationType.RESTRICTION,
        status: ModerationStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    for (const restriction of restrictions) {
      const metadata = restriction.metadata as any;
      if (metadata?.restrictions?.includes(action)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process expired moderation actions (background job)
   */
  async processExpiredActions(): Promise<number> {
    const expiredActions = await this.prisma.moderationAction.findMany({
      where: {
        status: ModerationStatus.ACTIVE,
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    let count = 0;
    for (const action of expiredActions) {
      try {
        await this.prisma.moderationAction.update({
          where: { id: action.id },
          data: { status: ModerationStatus.EXPIRED },
        });

        // Revert the action
        await this.revertModerationAction(action);
        count++;
      } catch (error) {
        console.error(
          `Failed to expire moderation action ${action.id}:`,
          error,
        );
      }
    }

    return count;
  }

  /**
   * Validate that the target exists
   */
  private async validateTarget(
    targetType: string,
    targetId: string,
  ): Promise<void> {
    let exists = false;

    switch (targetType.toLowerCase()) {
      case 'user':
        exists = !!(await this.prisma.user.findUnique({
          where: { id: targetId },
        }));
        break;
      case 'listing':
        exists = !!(await this.prisma.listing.findUnique({
          where: { id: targetId },
        }));
        break;
      case 'review':
        exists = !!(await this.prisma.review.findUnique({
          where: { id: targetId },
        }));
        break;
      case 'message':
        exists = !!(await this.prisma.message.findUnique({
          where: { id: targetId },
        }));
        break;
      default:
        throw new BadRequestException(`Invalid target type: ${targetType}`);
    }

    if (!exists) {
      throw new NotFoundException(`${targetType} not found`);
    }
  }

  /**
   * Apply the moderation action to the target
   */
  private async applyModerationAction(action: ModerationAction): Promise<void> {
    try {
      switch (action.actionType) {
        case ModerationType.WARNING:
          // Warning just creates a record, no changes needed
          break;

        case ModerationType.RESTRICTION:
          // Restrictions are checked at runtime via canPerformAction()
          break;

        case ModerationType.SUSPENSION:
          if (action.targetType === 'User') {
            await this.prisma.user.update({
              where: { id: action.targetId },
              data: { status: UserStatus.SUSPENDED },
            });
          }
          break;

        case ModerationType.BAN:
          if (action.targetType === 'User') {
            await this.prisma.user.update({
              where: { id: action.targetId },
              data: { status: UserStatus.BANNED },
            });
          }
          break;

        case ModerationType.CONTENT_REMOVAL:
          await this.removeTargetContent(action.targetType, action.targetId);
          break;
      }
    } catch (error) {
      console.error(`Failed to apply moderation action ${action.id}:`, error);
      throw error;
    }
  }

  /**
   * Revert a moderation action
   */
  private async revertModerationAction(
    action: ModerationAction,
  ): Promise<void> {
    try {
      switch (action.actionType) {
        case ModerationType.SUSPENSION:
          if (action.targetType === 'User') {
            // Check if user has other active suspensions or bans
            const hasOtherActions = await this.hasActiveRestrictions(
              action.targetId,
            );
            if (!hasOtherActions) {
              await this.prisma.user.update({
                where: { id: action.targetId },
                data: { status: UserStatus.VERIFIED },
              });
            }
          }
          break;

        case ModerationType.BAN:
          if (action.targetType === 'User') {
            await this.prisma.user.update({
              where: { id: action.targetId },
              data: { status: UserStatus.VERIFIED },
            });
          }
          break;

        // Other action types don't need reversion
      }
    } catch (error) {
      console.error(`Failed to revert moderation action ${action.id}:`, error);
    }
  }

  /**
   * Remove target content
   */
  private async removeTargetContent(
    targetType: string,
    targetId: string,
  ): Promise<void> {
    switch (targetType.toLowerCase()) {
      case 'listing':
        await this.prisma.listing.update({
          where: { id: targetId },
          data: { status: 'REJECTED' },
        });
        break;

      case 'review':
        await this.prisma.review.update({
          where: { id: targetId },
          data: { status: 'REMOVED' },
        });
        break;

      case 'message':
        await this.prisma.message.update({
          where: { id: targetId },
          data: { deletedAt: new Date() },
        });
        break;
    }
  }
}
