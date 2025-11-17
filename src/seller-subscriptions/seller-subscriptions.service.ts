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

    const subscription = await this.prisma.sellerSubscription.create({
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

    // Log the subscription creation
    await this.logSubscriptionEvent(
      subscription.id,
      'created',
      undefined,
      SubscriptionStatus.ACTIVE,
      {
        planId: plan.id,
        planName: plan.name,
        tier: plan.tier,
      },
    );

    return subscription;
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

    const oldStatus = subscription.status;
    const updatedSubscription = await this.prisma.sellerSubscription.update({
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

    // Log the cancellation
    await this.logSubscriptionEvent(
      subscriptionId,
      'cancelled',
      oldStatus,
      SubscriptionStatus.CANCELLED,
      {
        reason: cancelDto?.reason,
      },
    );

    return updatedSubscription;
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

    const oldPlanId = subscription.planId;
    const updatedSubscription = await this.prisma.sellerSubscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlan.id,
      },
      include: {
        plan: true,
        building: true,
      },
    });

    // Determine if this is an upgrade or downgrade
    const oldPlan = subscription.plan;
    const action = newPlan.monthlyPrice > oldPlan.monthlyPrice ? 'upgraded' : 'downgraded';

    // Log the plan change
    await this.logSubscriptionEvent(
      subscriptionId,
      action,
      subscription.status,
      subscription.status,
      {
        oldPlanId,
        oldPlanName: oldPlan.name,
        oldTier: oldPlan.tier,
        newPlanId: newPlan.id,
        newPlanName: newPlan.name,
        newTier: newPlan.tier,
      },
    );

    return updatedSubscription;
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
   * Renew a subscription (move to next billing period)
   */
  async renewSubscription(subscriptionId: string) {
    const subscription = await this.prisma.sellerSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Cannot renew cancelled subscription');
    }

    const now = new Date();
    const newRenewsAt = new Date(now);
    newRenewsAt.setMonth(newRenewsAt.getMonth() + 1);

    const oldStatus = subscription.status;
    const updatedSubscription = await this.prisma.sellerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        renewsAt: newRenewsAt,
      },
      include: {
        plan: true,
        building: true,
      },
    });

    // Log the renewal
    await this.logSubscriptionEvent(
      subscriptionId,
      'renewed',
      oldStatus,
      SubscriptionStatus.ACTIVE,
      {
        previousRenewsAt: subscription.renewsAt,
        newRenewsAt,
      },
    );

    return updatedSubscription;
  }

  /**
   * Put subscription into grace period after payment failure
   */
  async enterGracePeriod(subscriptionId: string) {
    const subscription = await this.prisma.sellerSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can enter grace period');
    }

    // Grace period is 7 days
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

    const updatedSubscription = await this.prisma.sellerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.GRACE_PERIOD,
        renewsAt: gracePeriodEnd,
      },
      include: {
        plan: true,
        building: true,
      },
    });

    // Log entering grace period (usually due to payment failure)
    await this.logSubscriptionEvent(
      subscriptionId,
      'payment_failed',
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.GRACE_PERIOD,
      {
        gracePeriodEnd,
      },
    );

    return updatedSubscription;
  }

  /**
   * Expire a subscription (after grace period or manual expiration)
   */
  async expireSubscription(subscriptionId: string) {
    const subscription = await this.prisma.sellerSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const oldStatus = subscription.status;
    const updatedSubscription = await this.prisma.sellerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.EXPIRED,
        endDate: new Date(),
      },
      include: {
        plan: true,
        building: true,
      },
    });

    // Log the expiration
    await this.logSubscriptionEvent(
      subscriptionId,
      'expired',
      oldStatus,
      SubscriptionStatus.EXPIRED,
      {},
    );

    return updatedSubscription;
  }

  /**
   * Admin: Get subscription statistics
   */
  async getSubscriptionStats(buildingId?: string) {
    const where = buildingId ? { buildingId } : {};

    // Get counts by tier
    const subscriptionsByTier = await this.prisma.sellerSubscription.groupBy({
      by: ['status'],
      where: {
        ...where,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
      },
      _count: true,
    });

    // Get all active/grace subscriptions with plan details
    const activeSubscriptions = await this.prisma.sellerSubscription.findMany({
      where: {
        ...where,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
      },
      include: {
        plan: true,
      },
    });

    // Calculate revenue and tier distribution
    const tierStats = {
      FREE: { count: 0, revenue: 0 },
      STANDARD: { count: 0, revenue: 0 },
      PREMIUM: { count: 0, revenue: 0 },
    };

    let totalRevenue = 0;
    for (const sub of activeSubscriptions) {
      const tier = sub.plan.tier;
      tierStats[tier].count++;
      tierStats[tier].revenue += sub.plan.monthlyPrice;
      totalRevenue += sub.plan.monthlyPrice;
    }

    return {
      totalActiveSubscriptions: activeSubscriptions.length,
      byStatus: subscriptionsByTier,
      byTier: tierStats,
      totalMonthlyRevenue: totalRevenue,
      buildingId: buildingId || 'all',
    };
  }

  /**
   * Admin: Override subscription status (manual intervention)
   */
  async overrideSubscription(
    subscriptionId: string,
    status: SubscriptionStatus,
    reason: string,
  ) {
    const subscription = await this.prisma.sellerSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.sellerSubscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        ...(status === SubscriptionStatus.CANCELLED && { endDate: new Date() }),
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
    });
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

  /**
   * Log a subscription event for audit trail
   */
  private async logSubscriptionEvent(
    subscriptionId: string,
    action: string,
    oldStatus?: string,
    newStatus?: string,
    metadata?: Record<string, any>,
  ) {
    return this.prisma.subscriptionLog.create({
      data: {
        subscriptionId,
        action,
        oldStatus,
        newStatus,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Auto-assign default FREE plan to a user for a building
   * Called when a user is verified or assigned to a building
   */
  async autoAssignFreePlan(userId: string, buildingId: string) {
    // Check if user already has a subscription for this building
    const existing = await this.prisma.sellerSubscription.findFirst({
      where: {
        userId,
        buildingId,
      },
    });

    if (existing) {
      // User already has a subscription, don't create another
      return existing;
    }

    // Get the default free plan
    const freePlan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        isDefaultFree: true,
        isActive: true,
      },
    });

    if (!freePlan) {
      // No default free plan available, skip auto-assignment
      console.warn('No default FREE plan found for auto-assignment');
      return null;
    }

    // Create FREE subscription
    const startDate = new Date();
    const renewsAt = new Date(startDate);
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    const subscription = await this.prisma.sellerSubscription.create({
      data: {
        userId,
        buildingId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        renewsAt,
      },
      include: {
        plan: true,
        building: true,
      },
    });

    // Log the event
    await this.logSubscriptionEvent(
      subscription.id,
      'created',
      undefined,
      SubscriptionStatus.ACTIVE,
      {
        planId: freePlan.id,
        planName: freePlan.name,
        tier: freePlan.tier,
        autoAssigned: true,
      },
    );

    return subscription;
  }
}
