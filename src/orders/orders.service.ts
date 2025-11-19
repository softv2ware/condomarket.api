import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { ChatService } from '~/chat/chat.service';
import { NotificationsService } from '~/notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrderStatus,
  ListingType,
  ListingStatus,
  Prisma,
  NotificationType,
  Order,
} from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private chatService: ChatService,
    private notificationsService: NotificationsService,
  ) {}

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
        profile: true,
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

    // Send notification to seller about new order
    try {
      await this.notificationsService.create({
        userId: listing.sellerId,
        type: NotificationType.ORDER_PLACED,
        title: 'New Order Received',
        message: `${buyer.profile?.firstName || 'A buyer'} placed an order for ${listing.title}`,
        data: {
          orderId: order.id,
          listingId: listing.id,
          buyerId: buyerId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send order placed notification: ${error.message}`);
    }

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

    const updatedOrder = await this.prisma.order.update({
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

    // Send notifications based on status change
    await this.sendOrderStatusNotification(updatedOrder, updateOrderStatusDto.status);

    return updatedOrder;
  }

  /**
   * Send notification when order status changes
   */
  private async sendOrderStatusNotification(
    order: Order & {
      listing: { title: string };
      statusHistory: Array<{ changedBy: string }>;
    },
    newStatus: OrderStatus,
  ): Promise<void> {
    try {
      let notificationType: NotificationType;
      let title: string;
      let message: string;
      let recipientId: string;

      switch (newStatus) {
        case OrderStatus.CONFIRMED:
          recipientId = order.buyerId;
          notificationType = NotificationType.ORDER_CONFIRMED;
          title = 'Order Confirmed';
          message = `Your order for ${order.listing.title} has been confirmed by the seller`;
          break;

        case OrderStatus.READY_FOR_PICKUP:
          recipientId = order.buyerId;
          notificationType = NotificationType.ORDER_READY;
          title = 'Order Ready for Pickup';
          message = `Your order for ${order.listing.title} is ready for pickup`;
          break;

        case OrderStatus.OUT_FOR_DELIVERY:
          recipientId = order.buyerId;
          notificationType = NotificationType.ORDER_DELIVERED;
          title = 'Order Out for Delivery';
          message = `Your order for ${order.listing.title} is out for delivery`;
          break;

        case OrderStatus.COMPLETED:
          recipientId = order.sellerId;
          notificationType = NotificationType.ORDER_COMPLETED;
          title = 'Order Completed';
          message = `Order for ${order.listing.title} has been marked as completed`;
          break;

        case OrderStatus.CANCELLED:
          // Notify the other party
          recipientId = order.buyerId === order.sellerId ? order.buyerId : 
                        (order.statusHistory[0]?.changedBy === order.buyerId ? order.sellerId : order.buyerId);
          notificationType = NotificationType.ORDER_CANCELLED;
          title = 'Order Cancelled';
          message = `Order for ${order.listing.title} has been cancelled`;
          break;

        default:
          return; // No notification for other statuses
      }

      await this.notificationsService.create({
        userId: recipientId,
        type: notificationType,
        title,
        message,
        data: {
          orderId: order.id,
          listingId: order.listingId,
          status: newStatus,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send order status notification: ${error.message}`);
    }
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
    const order = await this.updateStatus(
      id,
      {
        status: OrderStatus.CONFIRMED,
      },
      sellerId,
    );

    // Auto-create chat thread for order communication
    try {
      await this.chatService.createThread({
        orderId: id,
        participantIds: [order.buyerId, order.sellerId],
      });
      this.logger.log(`Chat thread created for order ${id}`);
    } catch (error) {
      this.logger.error(`Failed to create chat thread for order ${id}: ${error.message}`);
      // Don't fail the order confirmation if chat creation fails
    }

    return order;
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
