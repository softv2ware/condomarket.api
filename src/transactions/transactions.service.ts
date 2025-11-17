import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionStatus } from '../prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(createTransactionDto: CreateTransactionDto, userId: string) {
    // Validate that either orderId or bookingId is provided
    if (!createTransactionDto.orderId && !createTransactionDto.bookingId) {
      throw new BadRequestException(
        'Either orderId or bookingId must be provided',
      );
    }

    if (createTransactionDto.orderId && createTransactionDto.bookingId) {
      throw new BadRequestException(
        'Cannot provide both orderId and bookingId',
      );
    }

    let currency = 'USD';
    let sellerId: string;

    // Validate order if provided
    if (createTransactionDto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: createTransactionDto.orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Only buyer or seller can create transaction
      if (order.buyerId !== userId && order.sellerId !== userId) {
        throw new ForbiddenException(
          'You do not have access to create a transaction for this order',
        );
      }

      currency = order.currency;
      sellerId = order.sellerId;
    }

    // Validate booking if provided
    if (createTransactionDto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: createTransactionDto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Only buyer or seller can create transaction
      if (booking.buyerId !== userId && booking.sellerId !== userId) {
        throw new ForbiddenException(
          'You do not have access to create a transaction for this booking',
        );
      }

      currency = booking.currency;
      sellerId = booking.sellerId;
    }

    // Create transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        orderId: createTransactionDto.orderId,
        bookingId: createTransactionDto.bookingId,
        amount: createTransactionDto.amount,
        currency,
        paymentMethod: createTransactionDto.paymentMethod,
        status: createTransactionDto.paidAt
          ? TransactionStatus.COMPLETED
          : TransactionStatus.PENDING,
        paidAt: createTransactionDto.paidAt
          ? new Date(createTransactionDto.paidAt)
          : null,
        notes: createTransactionDto.notes,
      },
      include: {
        order: {
          select: {
            id: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return transaction;
  }

  async findAll(userId: string) {
    // Find all transactions where user is buyer or seller of the order/booking
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          {
            order: {
              OR: [{ buyerId: userId }, { sellerId: userId }],
            },
          },
          {
            booking: {
              OR: [{ buyerId: userId }, { sellerId: userId }],
            },
          },
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
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
            listing: true,
          },
        },
        booking: {
          include: {
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
            listing: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verify user has access
    const isBuyerOrSeller =
      (transaction.order?.buyerId === userId ||
        transaction.order?.sellerId === userId) ||
      (transaction.booking?.buyerId === userId ||
        transaction.booking?.sellerId === userId);

    if (!isBuyerOrSeller) {
      throw new ForbiddenException(
        'You do not have access to this transaction',
      );
    }

    return transaction;
  }

  async markAsPaid(id: string, userId: string) {
    const transaction = await this.findOne(id, userId);

    if (transaction.status === TransactionStatus.COMPLETED) {
      throw new BadRequestException('Transaction is already marked as paid');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.COMPLETED,
        paidAt: new Date(),
      },
      include: {
        order: {
          select: {
            id: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
  }

  async markAsFailed(id: string, userId: string, reason?: string) {
    const transaction = await this.findOne(id, userId);

    if (transaction.status === TransactionStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot mark a completed transaction as failed',
      );
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.FAILED,
        notes: reason
          ? `${transaction.notes || ''}\n\nFailed: ${reason}`.trim()
          : transaction.notes,
      },
    });
  }

  async getStatistics(userId: string, role: 'buyer' | 'seller') {
    const where = {
      status: TransactionStatus.COMPLETED,
      ...(role === 'buyer'
        ? {
            OR: [
              { order: { buyerId: userId } },
              { booking: { buyerId: userId } },
            ],
          }
        : {
            OR: [
              { order: { sellerId: userId } },
              { booking: { sellerId: userId } },
            ],
          }),
    };

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        amount: true,
        currency: true,
        paidAt: true,
      },
    });

    const totalRevenue = transactions.reduce(
      (sum, txn) => sum + txn.amount,
      0,
    );

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthTransactions = transactions.filter(
      (txn) => txn.paidAt && txn.paidAt >= thisMonth,
    );

    const monthlyRevenue = thisMonthTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0,
    );

    return {
      totalTransactions: transactions.length,
      totalRevenue,
      monthlyRevenue,
      currency: transactions[0]?.currency || 'USD',
    };
  }
}
