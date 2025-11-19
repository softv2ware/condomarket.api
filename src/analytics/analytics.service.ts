import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Platform Admin Analytics
   */
  async getPlatformOverview() {
    const cacheKey = 'analytics:platform:overview';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [
      totalUsers,
      totalBuildings,
      totalListings,
      activeListings,
      totalOrders,
      totalBookings,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.building.count({ where: { status: 'ACTIVE' } }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.order.count(),
      this.prisma.booking.count(),
      this.getTotalRevenue(),
    ]);

    const data = {
      totalUsers,
      totalBuildings,
      totalListings,
      activeListings,
      totalOrders,
      totalBookings,
      totalRevenue,
      timestamp: new Date().toISOString(),
    };

    await this.cache.set(cacheKey, data, 300); // 5 minutes
    return data;
  }

  async getBuildingStatistics() {
    const buildings = await this.prisma.building.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: {
          select: {
            residents: true,
            listings: true,
            orders: true,
            bookings: true,
          },
        },
      },
      take: 100,
    });

    return buildings.map((building) => ({
      id: building.id,
      name: building.name,
      address: building.address,
      residentsCount: building._count.residents,
      listingsCount: building._count.listings,
      ordersCount: building._count.orders,
      bookingsCount: building._count.bookings,
    }));
  }

  async getUserGrowth(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const users = await this.prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    return users;
  }

  async getSubscriptionMetrics() {
    const [
      totalSubscriptions,
      activeSubscriptions,
      subscriptionsByTier,
    ] = await Promise.all([
      this.prisma.sellerSubscription.count(),
      this.prisma.sellerSubscription.count({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.sellerSubscription.groupBy({
        by: ['planId'],
        _count: true,
        where: { status: 'ACTIVE' },
      }),
    ]);

    return {
      totalSubscriptions,
      activeSubscriptions,
      subscriptionsByTier,
    };
  }

  /**
   * Building Admin Analytics
   */
  async getBuildingOverview(buildingId: string) {
    const cacheKey = this.cache.buildingKey(buildingId, 'overview');
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [
      totalResidents,
      verifiedResidents,
      totalListings,
      activeListings,
      totalOrders,
      totalBookings,
    ] = await Promise.all([
      this.prisma.residentBuilding.count({ where: { buildingId } }),
      this.prisma.residentBuilding.count({
        where: { buildingId, verificationStatus: 'VERIFIED' },
      }),
      this.prisma.listing.count({ where: { buildingId } }),
      this.prisma.listing.count({
        where: { buildingId, status: 'ACTIVE' },
      }),
      this.prisma.order.count({ where: { buildingId } }),
      this.prisma.booking.count({ where: { buildingId } }),
    ]);

    const data = {
      totalResidents,
      verifiedResidents,
      totalListings,
      activeListings,
      totalOrders,
      totalBookings,
      timestamp: new Date().toISOString(),
    };

    await this.cache.set(cacheKey, data, 300); // 5 minutes
    return data;
  }

  async getBuildingListingPerformance(buildingId: string, limit: number = 10) {
    const listings = await this.prisma.listing.findMany({
      where: {
        buildingId,
        status: 'ACTIVE',
      },
      orderBy: [
        { viewCount: 'desc' },
        { orderCount: 'desc' },
      ],
      take: limit,
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    });

    return listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      type: listing.type,
      viewCount: listing.viewCount,
      orderCount: listing.orderCount,
      ordersCount: listing._count.orders,
      reviewsCount: listing._count.reviews,
      seller: {
        id: listing.seller.id,
        name: listing.seller.profile
          ? `${listing.seller.profile.firstName} ${listing.seller.profile.lastName}`
          : listing.seller.email,
      },
    }));
  }

  async getBuildingTopSellers(buildingId: string, limit: number = 10) {
    const sellers = await this.prisma.user.findMany({
      where: {
        role: 'SELLER',
        residentBuildings: {
          some: {
            buildingId,
            verificationStatus: 'VERIFIED',
          },
        },
      },
      take: limit,
      include: {
        profile: true,
        _count: {
          select: {
            listingsAsSeller: true,
            ordersAsSeller: true,
            bookingsAsSeller: true,
          },
        },
        reputation: true,
      },
      orderBy: {
        ordersAsSeller: {
          _count: 'desc',
        },
      },
    });

    return sellers.map((seller) => ({
      id: seller.id,
      email: seller.email,
      name: seller.profile
        ? `${seller.profile.firstName} ${seller.profile.lastName}`
        : null,
      listingsCount: seller._count.listingsAsSeller,
      ordersCount: seller._count.ordersAsSeller,
      bookingsCount: seller._count.bookingsAsSeller,
      sellerRating: seller.reputation?.sellerRating || null,
      totalOrders: seller.reputation?.totalOrders || 0,
    }));
  }

  async getBuildingCategoryDistribution(buildingId: string) {
    const categories = await this.prisma.listing.groupBy({
      by: ['categoryId'],
      where: {
        buildingId,
        status: 'ACTIVE',
      },
      _count: true,
    });

    const categoryDetails = await this.prisma.category.findMany({
      where: {
        id: { in: categories.map((c) => c.categoryId).filter(Boolean) as string[] },
      },
    });

    return categories.map((cat) => {
      const category = categoryDetails.find((c) => c.id === cat.categoryId);
      return {
        categoryId: cat.categoryId,
        categoryName: category?.name || 'Uncategorized',
        count: cat._count,
      };
    });
  }

  /**
   * Seller Analytics
   */
  async getSellerOverview(userId: string) {
    const cacheKey = this.cache.userKey(userId, 'seller-overview');
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [
      totalListings,
      activeListings,
      totalOrders,
      totalBookings,
      totalRevenue,
      reputation,
    ] = await Promise.all([
      this.prisma.listing.count({ where: { sellerId: userId } }),
      this.prisma.listing.count({
        where: { sellerId: userId, status: 'ACTIVE' },
      }),
      this.prisma.order.count({ where: { sellerId: userId } }),
      this.prisma.booking.count({ where: { sellerId: userId } }),
      this.getSellerRevenue(userId),
      this.prisma.userReputation.findUnique({ where: { userId } }),
    ]);

    const data = {
      totalListings,
      activeListings,
      totalOrders,
      totalBookings,
      totalRevenue,
      sellerRating: reputation?.sellerRating || null,
      completionRate: reputation?.completionRate || null,
      responseRate: reputation?.responseRate || null,
      timestamp: new Date().toISOString(),
    };

    await this.cache.set(cacheKey, data, 300); // 5 minutes
    return data;
  }

  async getSellerListingPerformance(userId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { sellerId: userId },
      include: {
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
      orderBy: { viewCount: 'desc' },
    });

    return listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      type: listing.type,
      status: listing.status,
      viewCount: listing.viewCount,
      orderCount: listing.orderCount,
      ordersCount: listing._count.orders,
      reviewsCount: listing._count.reviews,
      createdAt: listing.createdAt,
    }));
  }

  async getSellerRevenueByPeriod(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: {
        sellerId: userId,
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      select: {
        totalPrice: true,
        completedAt: true,
      },
    });

    const bookings = await this.prisma.booking.findMany({
      where: {
        sellerId: userId,
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      select: {
        totalPrice: true,
        completedAt: true,
      },
    });

    return {
      orders: orders.length,
      bookings: bookings.length,
      totalRevenue:
        orders.reduce((sum, o) => sum + o.totalPrice.toNumber(), 0) +
        bookings.reduce((sum, b) => sum + b.totalPrice.toNumber(), 0),
    };
  }

  /**
   * Helper methods
   */
  private async getTotalRevenue(): Promise<number> {
    const [orders, bookings] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
      this.prisma.booking.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
    ]);

    return (
      (orders._sum.totalPrice?.toNumber() || 0) +
      (bookings._sum.totalPrice?.toNumber() || 0)
    );
  }

  private async getSellerRevenue(userId: string): Promise<number> {
    const [orders, bookings] = await Promise.all([
      this.prisma.order.aggregate({
        where: { sellerId: userId, status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
      this.prisma.booking.aggregate({
        where: { sellerId: userId, status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
    ]);

    return (
      (orders._sum.totalPrice?.toNumber() || 0) +
      (bookings._sum.totalPrice?.toNumber() || 0)
    );
  }
}
