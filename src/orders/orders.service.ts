import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrderStatus,
  ListingType,
  ListingStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto, buyerId: string) {
    // 1. Validate listing exists and is available
    const listing = await this.prisma.listing.findUnique({
      where: { id: createOrderDto.listingId },
      include: {
        seller: {
          include: {
            residences: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.type !== ListingType.PRODUCT) {
      throw new BadRequestException(
        'Orders are only for products. Use bookings for services.',
      );
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not available for purchase');
    }

    // 2. Verify buyer exists and get their building
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerId },
      include: {
        residences: true,
      },
    });

    if (!buyer || buyer.residences.length === 0) {
      throw new ForbiddenException('Buyer must be a verified resident');
    }

    // 3. Verify buyer and seller are in the same building
    const buyerBuildingId = buyer.residences[0].buildingId;
    const sellerBuildingId = listing.seller.residences[0]?.buildingId;

    if (buyerBuildingId !== sellerBuildingId) {
      throw new ForbiddenException(
        'Orders are only allowed within the same building',
      );
    }

    // 4. Prevent self-purchase
    if (buyerId === listing.sellerId) {
      throw new BadRequestException('You cannot order your own listing');
    }

    // 5. Calculate total price
    const totalPrice = listing.price * createOrderDto.quantity;

    // 6. Validate delivery details
    if (
      createOrderDto.deliveryMethod === 'PICKUP' &&
      !createOrderDto.pickupLocation
    ) {
      throw new BadRequestException(
        'Pickup location is required for PICKUP delivery method',
      );
    }

    if (
      createOrderDto.deliveryMethod === 'DELIVERY' &&
      !createOrderDto.deliveryAddress
    ) {
      throw new BadRequestException(
        'Delivery address is required for DELIVERY delivery method',
      );
    }

    // 7. Create the order with status history
    const order = await this.prisma.order.create({
      data: {
        listingId: listing.id,
        buyerId,
        sellerId: listing.sellerId,
        buildingId: buyerBuildingId,
        type: listing.type,
        status: OrderStatus.PENDING_CONFIRMATION,
        quantity: createOrderDto.quantity,
        totalPrice,
        currency: listing.currency,
        deliveryMethod: createOrderDto.deliveryMethod,
        pickupLocation: createOrderDto.pickupLocation,
        deliveryAddress: createOrderDto.deliveryAddress,
        scheduledFor: createOrderDto.scheduledFor
          ? new Date(createOrderDto.scheduledFor)
          : undefined,
        notes: createOrderDto.notes,
        statusHistory: {
          create: {
            status: OrderStatus.PENDING_CONFIRMATION,
            changedBy: buyerId,
          },
        },
      },
      include: {
        listing: true,
        buyer: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
    });

    return order;
  }

  async findAll(userId: string, role?: 'buyer' | 'seller') {
    const where: Prisma.OrderWhereInput = role
      ? role === 'buyer'
        ? { buyerId: userId }
        : { sellerId: userId }
      : {
          OR: [{ buyerId: userId }, { sellerId: userId }],
        };

    return this.prisma.order.findMany({
      where,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            photos: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
        buyer: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        listing: true,
        buyer: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        transactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify user is buyer or seller
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    userId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify user is buyer or seller
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    // Validate status transitions
    this.validateStatusTransition(
      order.status,
      updateOrderStatusDto.status,
      userId,
      order.sellerId,
    );

    // Prepare update data
    const updateData: Prisma.OrderUpdateInput = {
      status: updateOrderStatusDto.status,
      statusHistory: {
        create: {
          status: updateOrderStatusDto.status,
          changedBy: userId,
          reason: updateOrderStatusDto.reason,
        },
      },
    };

    // Set timestamp fields based on status
    if (updateOrderStatusDto.status === OrderStatus.CONFIRMED) {
      updateData.confirmedAt = new Date();
    } else if (updateOrderStatusDto.status === OrderStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = updateOrderStatusDto.reason;
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        listing: true,
        buyer: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
    userId: string,
    sellerId: string,
  ) {
    const isSeller = userId === sellerId;

    // Define valid transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_CONFIRMATION]: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
        OrderStatus.EXPIRED,
      ],
      [OrderStatus.CONFIRMED]: [
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.READY_FOR_PICKUP]: [
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.OUT_FOR_DELIVERY]: [
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.EXPIRED]: [],
    };

    // Check if transition is valid
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // Only seller can confirm or mark ready/delivery
    const sellerOnlyStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.OUT_FOR_DELIVERY,
    ];
    
    if (
      sellerOnlyStatuses.some((status) => status === newStatus) &&
      !isSeller
    ) {
      throw new ForbiddenException(
        'Only the seller can perform this status change',
      );
    }

    // Both can cancel or complete
    // System can expire
  }

  async cancel(id: string, userId: string, reason?: string) {
    return this.updateStatus(
      id,
      {
        status: OrderStatus.CANCELLED,
        reason,
      },
      userId,
    );
  }

  async confirm(id: string, sellerId: string) {
    return this.updateStatus(
      id,
      {
        status: OrderStatus.CONFIRMED,
      },
      sellerId,
    );
  }

  async markReadyForPickup(id: string, sellerId: string) {
    return this.updateStatus(
      id,
      {
        status: OrderStatus.READY_FOR_PICKUP,
      },
      sellerId,
    );
  }

  async markOutForDelivery(id: string, sellerId: string) {
    return this.updateStatus(
      id,
      {
        status: OrderStatus.OUT_FOR_DELIVERY,
      },
      sellerId,
    );
  }

  async complete(id: string, userId: string) {
    return this.updateStatus(
      id,
      {
        status: OrderStatus.COMPLETED,
      },
      userId,
    );
  }

  // Background job method to auto-expire pending orders
  async expirePendingOrders() {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const ordersToExpire = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_CONFIRMATION,
        createdAt: {
          lt: fortyEightHoursAgo,
        },
      },
    });

    for (const order of ordersToExpire) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.EXPIRED,
          statusHistory: {
            create: {
              status: OrderStatus.EXPIRED,
              changedBy: 'SYSTEM',
              reason: 'Order not confirmed within 48 hours',
            },
          },
        },
      });
    }

    return {
      expired: ordersToExpire.length,
    };
  }
}
