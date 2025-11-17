import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateSellerSubscriptionDto } from './dto/create-seller-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { SubscriptionStatus } from '../prisma/client';

@Injectable()
export class SellerSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Subscribe a user to a plan
   * Enforces one subscription per user per building
   */
  async subscribe(
    userId: string,
    createDto: CreateSellerSubscriptionDto,
  ) {
    // Get the subscription plan
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: createDto.subscriptionPlanId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (!plan.isActive) {
      throw new BadRequestException('This subscription plan is not available');
    }

    // If plan is building-specific, buildingId is required
    if (plan.buildingId && !createDto.buildingId) {
      throw new BadRequestException(
        'buildingId is required for building-specific plans',
      );
    }

    // If buildingId provided, it must match the plan's building
    if (createDto.buildingId && plan.buildingId !== createDto.buildingId) {
      throw new BadRequestException(
        'Plan does not belong to the specified building',
      );
    }

    const buildingId = createDto.buildingId || plan.buildingId;

    if (!buildingId) {
      throw new BadRequestException('buildingId is required');
    }

    // Check if user already has an active subscription for this building
    const existing = await this.prisma.sellerSubscription.findFirst({
      where: {
        userId,
        buildingId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
      },
    });

    if (existing) {
      throw new ConflictException(
        'You already have an active subscription for this building',
      );
    }

    // Create the subscription
    const startDate = new Date();
    const renewsAt = new Date(startDate);
    renewsAt.setMonth(renewsAt.getMonth() + 1); // Next renewal in 1 month

    return this.prisma.sellerSubscription.create({
      data: {
        userId,
        buildingId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        renewsAt,
      },
      include: {
        plan: true,
        building: true,
      },
    });
  }

  /**
   * Get all subscriptions for a user
   */
  async getMySubscriptions(userId: string) {
    return this.prisma.sellerSubscription.findMany({
      where: { userId },
      include: {
        plan: true,
        building: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific subscription by ID
   */
  async findOne(id: string, userId?: string) {
    const subscription = await this.prisma.sellerSubscription.findUnique({
      where: { id },
      include: {
        plan: true,
        building: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // If userId provided, verify ownership
    if (userId && subscription.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancel(
    subscriptionId: string,
    userId: string,
    cancelDto?: CancelSubscriptionDto,
  ) {
    const subscription = await this.findOne(subscriptionId, userId);

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    return this.prisma.sellerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        endDate: new Date(), // Set end date to now
      },
      include: {
        plan: true,
        building: true,
      },
    });
  }

  /**
   * Change subscription plan (upgrade or downgrade)
   */
  async changePlan(
    subscriptionId: string,
    userId: string,
    changePlanDto: ChangePlanDto,
  ) {
    const subscription = await this.findOne(subscriptionId, userId);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Can only change plan for active subscriptions',
      );
    }

    const newPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: changePlanDto.newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException('New subscription plan not found');
    }

    if (!newPlan.isActive) {
      throw new BadRequestException('The selected plan is not available');
    }

    // Verify plan belongs to same building (or is platform-wide)
    if (
      subscription.buildingId &&
      newPlan.buildingId &&
      newPlan.buildingId !== subscription.buildingId
    ) {
      throw new BadRequestException(
        'Cannot change to a plan from a different building',
      );
    }

    if (subscription.planId === newPlan.id) {
      throw new BadRequestException('You are already on this plan');
    }

    return this.prisma.sellerSubscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlan.id,
      },
      include: {
        plan: true,
        building: true,
      },
    });
  }

  /**
   * Get subscription for a specific building (for listing enforcement)
   */
  async getActiveSubscriptionForBuilding(userId: string, buildingId: string) {
    return this.prisma.sellerSubscription.findFirst({
      where: {
        userId,
        buildingId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
      },
      include: {
        plan: true,
      },
    });
  }

  /**
   * Check if user can create a listing in a building
   * Returns whether user can create listing and how many slots remaining
   */
  async canCreateListing(userId: string, buildingId: string) {
    const subscription = await this.getActiveSubscriptionForBuilding(
      userId,
      buildingId,
    );

    if (!subscription) {
      return {
        canCreate: false,
        reason: 'No active subscription found for this building',
        maxListings: 0,
        currentListings: 0,
        remainingSlots: 0,
      };
    }

    // TODO: Count active listings when Listing model is created in Stage 4
    // For now, we'll assume 0 listings
    const currentListings = 0;
    // await this.prisma.listing.count({
    //   where: {
    //     userId,
    //     buildingId,
    //     status: ListingStatus.ACTIVE,
    //   },
    // });

    const maxListings = subscription.plan.maxActiveListings;
    const remainingSlots = maxListings - currentListings;

    return {
      canCreate: currentListings < maxListings,
      maxListings,
      currentListings,
      remainingSlots,
      subscriptionPlan: subscription.plan.name,
      subscriptionTier: subscription.plan.tier,
    };
  }

  /**
   * Admin: Get all subscriptions with filters
   */
  async findAll(buildingId?: string, status?: SubscriptionStatus) {
    return this.prisma.sellerSubscription.findMany({
      where: {
        ...(buildingId && { buildingId }),
        ...(status && { status }),
      },
      include: {
        plan: true,
        building: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
