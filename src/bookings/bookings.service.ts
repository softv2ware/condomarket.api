import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import {
  BookingStatus,
  ListingType,
  ListingStatus,
  Prisma,
} from '../prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(createBookingDto: CreateBookingDto, buyerId: string) {
    // 1. Validate listing exists and is a service
    const listing = await this.prisma.listing.findUnique({
      where: { id: createBookingDto.listingId },
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

    if (listing.type !== ListingType.SERVICE) {
      throw new BadRequestException(
        'Bookings are only for services. Use orders for products.',
      );
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Service is not available for booking');
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
        'Bookings are only allowed within the same building',
      );
    }

    // 4. Prevent self-booking
    if (buyerId === listing.sellerId) {
      throw new BadRequestException('You cannot book your own service');
    }

    // 5. Validate time range
    const startTime = new Date(createBookingDto.startTime);
    const endTime = new Date(createBookingDto.endTime);
    const now = new Date();

    if (startTime < now) {
      throw new BadRequestException('Start time must be in the future');
    }

    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const actualDuration = (endTime.getTime() - startTime.getTime()) / 60000; // minutes
    if (Math.abs(actualDuration - createBookingDto.durationMinutes) > 1) {
      throw new BadRequestException(
        'Duration does not match the time range provided',
      );
    }

    // 6. Check for time slot conflicts
    const hasConflict = await this.checkTimeSlotConflict(
      listing.id,
      startTime,
      endTime,
    );

    if (hasConflict) {
      throw new ConflictException(
        'This time slot is already booked or conflicts with an existing booking',
      );
    }

    // 7. Calculate total price (could be hourly rate * hours)
    const hours = createBookingDto.durationMinutes / 60;
    const totalPrice = listing.price * hours;

    // 8. Create the booking with status history
    const booking = await this.prisma.booking.create({
      data: {
        listingId: listing.id,
        buyerId,
        sellerId: listing.sellerId,
        buildingId: buyerBuildingId,
        status: BookingStatus.REQUESTED,
        startTime,
        endTime,
        durationMinutes: createBookingDto.durationMinutes,
        totalPrice,
        currency: listing.currency,
        location: createBookingDto.location,
        notes: createBookingDto.notes,
        statusHistory: {
          create: {
            status: BookingStatus.REQUESTED,
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

    return booking;
  }

  async checkTimeSlotConflict(
    listingId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    // Check for overlapping bookings that are not cancelled or no-show
    const overlappingBookings = await this.prisma.booking.findMany({
      where: {
        listingId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
        OR: [
          // New booking starts during an existing booking
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          // New booking ends during an existing booking
          {
            AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }],
          },
          // New booking completely contains an existing booking
          {
            AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }],
          },
        ],
      },
    });

    return overlappingBookings.length > 0;
  }

  async findAll(userId: string, role?: 'buyer' | 'seller') {
    const where: Prisma.BookingWhereInput = role
      ? role === 'buyer'
        ? { buyerId: userId }
        : { sellerId: userId }
      : {
          OR: [{ buyerId: userId }, { sellerId: userId }],
        };

    return this.prisma.booking.findMany({
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
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
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

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify user is buyer or seller
    if (booking.buyerId !== userId && booking.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    return booking;
  }

  async updateStatus(
    id: string,
    updateBookingStatusDto: UpdateBookingStatusDto,
    userId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify user is buyer or seller
    if (booking.buyerId !== userId && booking.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    // Validate status transitions
    this.validateStatusTransition(
      booking.status,
      updateBookingStatusDto.status,
      userId,
      booking.sellerId,
    );

    // Prepare update data
    const updateData: Prisma.BookingUpdateInput = {
      status: updateBookingStatusDto.status,
      statusHistory: {
        create: {
          status: updateBookingStatusDto.status,
          changedBy: userId,
          reason: updateBookingStatusDto.reason,
        },
      },
    };

    // Set timestamp fields based on status
    if (updateBookingStatusDto.status === BookingStatus.CONFIRMED) {
      updateData.confirmedAt = new Date();
    } else if (updateBookingStatusDto.status === BookingStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (updateBookingStatusDto.status === BookingStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = updateBookingStatusDto.reason;
    }

    return this.prisma.booking.update({
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
    currentStatus: BookingStatus,
    newStatus: BookingStatus,
    userId: string,
    sellerId: string,
  ) {
    const isSeller = userId === sellerId;

    // Define valid transitions
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.REQUESTED]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.IN_PROGRESS,
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
      ],
      [BookingStatus.IN_PROGRESS]: [
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.NO_SHOW]: [],
    };

    // Check if transition is valid
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // Only seller can confirm, start service, or mark no-show
    const sellerOnlyStatuses = [
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.NO_SHOW,
    ];

    if (sellerOnlyStatuses.some((status) => status === newStatus) && !isSeller) {
      throw new ForbiddenException(
        'Only the seller can perform this status change',
      );
    }

    // Both can cancel or complete
  }

  async cancel(id: string, userId: string, reason?: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.CANCELLED,
        reason,
      },
      userId,
    );
  }

  async confirm(id: string, sellerId: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.CONFIRMED,
      },
      sellerId,
    );
  }

  async startService(id: string, sellerId: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.IN_PROGRESS,
      },
      sellerId,
    );
  }

  async complete(id: string, userId: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.COMPLETED,
      },
      userId,
    );
  }

  async markNoShow(id: string, sellerId: string, reason?: string) {
    return this.updateStatus(
      id,
      {
        status: BookingStatus.NO_SHOW,
        reason: reason || 'Buyer did not show up for the scheduled service',
      },
      sellerId,
    );
  }

  // Background job method to auto-cancel unconfirmed bookings
  async cancelUnconfirmedBookings() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const bookingsToCancel = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.REQUESTED,
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });

    for (const booking of bookingsToCancel) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Booking not confirmed within 24 hours',
          statusHistory: {
            create: {
              status: BookingStatus.CANCELLED,
              changedBy: 'SYSTEM',
              reason: 'Booking not confirmed within 24 hours',
            },
          },
        },
      });
    }

    return {
      cancelled: bookingsToCancel.length,
    };
  }

  // Get available time slots for a service
  async getAvailableSlots(
    listingId: string,
    date: string, // YYYY-MM-DD
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.type !== ListingType.SERVICE) {
      throw new BadRequestException('This endpoint is only for services');
    }

    // Get all bookings for this listing on the specified date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        listingId,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { startTime: 'asc' },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    return {
      date,
      bookedSlots: bookings.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    };
  }
}
