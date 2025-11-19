import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, BookingStatus } from '@prisma/client';
import { PrismaService } from '~/prisma';
import { ReputationEntity } from './entities/reputation.entity';

@Injectable()
export class ReputationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user reputation
   */
  async getReputation(userId: string): Promise<ReputationEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    // Create reputation record if it doesn't exist
    if (!reputation) {
      reputation = await this.prisma.userReputation.create({
        data: { userId },
      });
    }

    return new ReputationEntity(reputation);
  }

  /**
   * Calculate and update reputation for a user
   */
  async calculateReputation(userId: string): Promise<ReputationEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fetch completed orders and bookings as seller
    const ordersAsSeller = await this.prisma.order.findMany({
      where: { sellerId: userId, status: OrderStatus.COMPLETED },
      include: { reviews: true },
    });

    const bookingsAsSeller = await this.prisma.booking.findMany({
      where: { sellerId: userId, status: BookingStatus.COMPLETED },
      include: { reviews: true },
    });

    // Fetch completed orders and bookings as buyer
    const ordersAsBuyer = await this.prisma.order.findMany({
      where: { buyerId: userId, status: OrderStatus.COMPLETED },
      include: { reviews: true },
    });

    const bookingsAsBuyer = await this.prisma.booking.findMany({
      where: { buyerId: userId, status: BookingStatus.COMPLETED },
      include: { reviews: true },
    });

    // Calculate seller metrics
    const totalSales = ordersAsSeller.length + bookingsAsSeller.length;
    const salesVolume = [...ordersAsSeller, ...bookingsAsSeller].reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );

    const sellerReviews = [
      ...ordersAsSeller.flatMap((o) => o.reviews),
      ...bookingsAsSeller.flatMap((b) => b.reviews),
    ];
    const sellerRating =
      sellerReviews.length > 0
        ? sellerReviews.reduce((sum, r) => sum + r.rating, 0) /
          sellerReviews.length
        : null;

    // Calculate buyer metrics
    const totalPurchases = ordersAsBuyer.length + bookingsAsBuyer.length;
    const buyerReviews = [
      ...ordersAsBuyer.flatMap((o) => o.reviews),
      ...bookingsAsBuyer.flatMap((b) => b.reviews),
    ];
    const buyerRating =
      buyerReviews.length > 0
        ? buyerReviews.reduce((sum, r) => sum + r.rating, 0) /
          buyerReviews.length
        : null;

    // Calculate completion rate
    const [totalOrders, cancelledOrders] = await Promise.all([
      this.prisma.order.count({
        where: {
          OR: [{ sellerId: userId }, { buyerId: userId }],
        },
      }),
      this.prisma.order.count({
        where: {
          OR: [{ sellerId: userId }, { buyerId: userId }],
          status: OrderStatus.CANCELLED,
        },
      }),
    ]);

    const completionRate =
      totalOrders > 0 ? ((totalOrders - cancelledOrders) / totalOrders) * 100 : 0;

    // Calculate response rate and time (from messages)
    const threadIds = await this.prisma.chatThread.findMany({
      where: {
        participantIds: {
          has: userId,
        },
      },
      select: { id: true },
    });

    const messages = await this.prisma.message.findMany({
      where: {
        threadId: { in: threadIds.map(t => t.id) },
        senderId: userId,
      },
      orderBy: { sentAt: 'asc' },
    });

    // Calculate response time (simplified - time between first message in thread and user's first response)
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const thread of threadIds) {
      const threadMessages = await this.prisma.message.findMany({
        where: { threadId: thread.id },
        orderBy: { sentAt: 'asc' },
        take: 10,
      });

      const firstMessage = threadMessages.find(m => m.senderId !== userId);
      const firstResponse = threadMessages.find(m => m.senderId === userId);

      if (firstMessage && firstResponse) {
        const responseTime =
          firstResponse.sentAt.getTime() - firstMessage.sentAt.getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    const avgResponseTime =
      responseCount > 0 ? Math.floor(totalResponseTime / responseCount / (1000 * 60)) : null; // in minutes

    const responseRate = threadIds.length > 0 ? (responseCount / threadIds.length) * 100 : 0;

    // Calculate reliability score (0-100)
    let reliabilityScore = 50; // Base score

    if (sellerRating) reliabilityScore += (sellerRating - 3) * 10; // +/- 20 points
    if (buyerRating) reliabilityScore += (buyerRating - 3) * 5; // +/- 10 points
    reliabilityScore += Math.min(completionRate / 2, 20); // up to +20 points
    reliabilityScore += Math.min(responseRate / 5, 10); // up to +10 points

    // Penalize for low response time (if > 60 minutes)
    if (avgResponseTime && avgResponseTime > 60) {
      reliabilityScore -= 10;
    }

    reliabilityScore = Math.max(0, Math.min(100, reliabilityScore)); // Clamp 0-100

    // Determine badges
    const trustedSeller = totalSales >= 10 && sellerRating !== null && sellerRating >= 4.5;
    const fastResponder = avgResponseTime !== null && avgResponseTime < 30 && responseRate >= 80;
    const topRated =
      (sellerRating !== null && sellerRating >= 4.8) ||
      (buyerRating !== null && buyerRating >= 4.8);

    // Update or create reputation
    const reputation = await this.prisma.userReputation.upsert({
      where: { userId },
      create: {
        userId,
        sellerRating,
        totalSales,
        salesVolume,
        buyerRating,
        totalPurchases,
        completionRate,
        responseTime: avgResponseTime,
        responseRate,
        reliabilityScore,
        trustedSeller,
        fastResponder,
        topRated,
        lastCalculatedAt: new Date(),
      },
      update: {
        sellerRating,
        totalSales,
        salesVolume,
        buyerRating,
        totalPurchases,
        completionRate,
        responseTime: avgResponseTime,
        responseRate,
        reliabilityScore,
        trustedSeller,
        fastResponder,
        topRated,
        lastCalculatedAt: new Date(),
      },
    });

    return new ReputationEntity(reputation);
  }

  /**
   * Recalculate all user reputations (background job)
   */
  async recalculateAllReputations(): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: {
        status: { in: ['VERIFIED', 'SUSPENDED'] },
      },
      select: { id: true },
    });

    let count = 0;
    for (const user of users) {
      try {
        await this.calculateReputation(user.id);
        count++;
      } catch (error) {
        console.error(`Failed to calculate reputation for user ${user.id}:`, error);
      }
    }

    return count;
  }

  /**
   * Get top-rated users
   */
  async getTopRatedUsers(limit: number = 10) {
    const topUsers = await this.prisma.userReputation.findMany({
      where: {
        topRated: true,
      },
      orderBy: {
        reliabilityScore: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
    });

    return topUsers.map(rep => ({
      ...new ReputationEntity(rep),
      user: rep.user,
    }));
  }

  /**
   * Get trusted sellers
   */
  async getTrustedSellers(limit: number = 10) {
    const trustedSellers = await this.prisma.userReputation.findMany({
      where: {
        trustedSeller: true,
      },
      orderBy: {
        totalSales: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
    });

    return trustedSellers.map(rep => ({
      ...new ReputationEntity(rep),
      user: rep.user,
    }));
  }
}
