import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { PrismaService } from '~/prisma';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createSubscriptionPlanDto: CreateSubscriptionPlanDto) {
    // Check if plan with this tier already exists
    const existingPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { tier: createSubscriptionPlanDto.tier },
    });

    if (existingPlan) {
      throw new ConflictException(
        `A plan with tier ${createSubscriptionPlanDto.tier} already exists`,
      );
    }

    // If this is set as default free, unset any other default free plans
    if (createSubscriptionPlanDto.isDefaultFree) {
      await this.prisma.subscriptionPlan.updateMany({
        where: { isDefaultFree: true },
        data: { isDefaultFree: false },
      });
    }

    const created = await this.prisma.subscriptionPlan.create({
      data: createSubscriptionPlanDto,
      include: {
        building: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Invalidate all subscription plan caches
    await this.cacheService.delByPattern('subscription-plan*');

    return created;
  }

  async findAll(buildingId?: string) {
    const cacheKey = buildingId
      ? `subscription-plans:building=${buildingId}`
      : 'subscription-plans:all';

    return this.cacheService.wrap(
      cacheKey,
      async () => {
        return this.prisma.subscriptionPlan.findMany({
          where: {
            isActive: true,
            ...(buildingId
              ? { OR: [{ buildingId }, { buildingId: null }] }
              : {}),
          },
          include: {
            building: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                subscriptions: true,
              },
            },
          },
          orderBy: [{ sortPriority: 'desc' }, { monthlyPrice: 'asc' }],
        });
      },
      1800, // 30 minutes TTL - plans change infrequently
    );
  }

  async findOne(id: string) {
    return this.cacheService.wrap(
      `subscription-plan:${id}`,
      async () => {
        const plan = await this.prisma.subscriptionPlan.findUnique({
          where: { id },
          include: {
            building: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                subscriptions: true,
              },
            },
          },
        });

        if (!plan) {
          throw new NotFoundException(
            `Subscription plan with ID ${id} not found`,
          );
        }

        return plan;
      },
      1800, // 30 minutes TTL
    );
  }

  async findByTier(tier: string) {
    return this.prisma.subscriptionPlan.findUnique({
      where: { tier: tier as any },
    });
  }

  async getDefaultFreePlan() {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        isDefaultFree: true,
        isActive: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('No default free plan found');
    }

    return plan;
  }

  async update(
    id: string,
    updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }

    // If changing to default free, unset others
    if (updateSubscriptionPlanDto.isDefaultFree) {
      await this.prisma.subscriptionPlan.updateMany({
        where: { isDefaultFree: true, id: { not: id } },
        data: { isDefaultFree: false },
      });
    }

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: updateSubscriptionPlanDto,
      include: {
        building: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Invalidate all subscription plan caches
    await this.cacheService.delByPattern('subscription-plan*');

    return updated;
  }

  async remove(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }

    // Soft delete by setting isActive to false
    const removed = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate all subscription plan caches
    await this.cacheService.delByPattern('subscription-plan*');

    return removed;
  }
}
