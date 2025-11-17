import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SellerSubscriptionsService } from '../seller-subscriptions/seller-subscriptions.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { ListingStatus } from '../prisma/client';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SellerSubscriptionsService,
  ) {}

  /**
   * Create a new listing (DRAFT status)
   */
  async create(userId: string, createDto: CreateListingDto) {
    // Check subscription limits
    const limitCheck = await this.subscriptionsService.canCreateListing(
      userId,
      createDto.buildingId,
    );

    if (!limitCheck.canCreate) {
      throw new BadRequestException(
        limitCheck.reason || 'You have reached your listing limit. Please upgrade your subscription.',
      );
    }

    // Verify category exists
    const category = await this.prisma.category.findUnique({
      where: { id: createDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Verify building exists
    const building = await this.prisma.building.findUnique({
      where: { id: createDto.buildingId },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Get user's subscription tier for ranking
    const subscription = await this.subscriptionsService.getActiveSubscriptionForBuilding(
      userId,
      createDto.buildingId,
    );

    // Generate slug from title
    const slug = this.generateSlug(createDto.title);

    // Create listing
    return this.prisma.listing.create({
      data: {
        ...createDto,
        sellerId: userId,
        slug,
        status: ListingStatus.DRAFT,
        subscriptionTierSnapshot: subscription?.plan.tier,
      },
      include: {
        category: true,
        building: true,
        seller: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        photos: true,
      },
    });
  }

  /**
   * Get all active listings with search and filters
   */
  async findAll(searchDto: SearchListingsDto) {
    const {
      q,
      type,
      categoryId,
      buildingId,
      minPrice,
      maxPrice,
      status = ListingStatus.ACTIVE,
      page = 1,
      limit = 20,
    } = searchDto;

    const skip = (page - 1) * limit;

    const where: any = {
      status,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(buildingId && { buildingId }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined && { gte: minPrice }),
              ...(maxPrice !== undefined && { lte: maxPrice }),
            },
          }
        : {}),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          building: {
            select: {
              id: true,
              name: true,
            },
          },
          seller: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          photos: {
            where: { isMain: true },
            take: 1,
          },
        },
        orderBy: [
          { subscriptionTierSnapshot: 'desc' }, // Premium first
          { publishedAt: 'desc' },
        ],
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data: listings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get my listings
   */
  async findMyListings(userId: string, buildingId?: string) {
    return this.prisma.listing.findMany({
      where: {
        sellerId: userId,
        ...(buildingId && { buildingId }),
      },
      include: {
        category: true,
        building: {
          select: {
            id: true,
            name: true,
          },
        },
        photos: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get featured/highlighted listings (PREMIUM tier)
   */
  async findFeatured(buildingId?: string) {
    return this.prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        subscriptionTierSnapshot: 'PREMIUM',
        ...(buildingId && { buildingId }),
      },
      include: {
        category: true,
        building: {
          select: {
            id: true,
            name: true,
          },
        },
        seller: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        photos: {
          where: { isMain: true },
          take: 1,
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });
  }

  /**
   * Get single listing by ID
   */
  async findOne(id: string, incrementView = false) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        category: true,
        building: true,
        seller: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        photos: {
          orderBy: { order: 'asc' },
        },
        availability: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Increment view count if requested
    if (incrementView) {
      await this.prisma.listing.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return listing;
  }

  /**
   * Update listing
   */
  async update(id: string, userId: string, updateDto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Verify ownership
    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    // Update slug if title changed
    const slug = updateDto.title
      ? this.generateSlug(updateDto.title)
      : undefined;

    return this.prisma.listing.update({
      where: { id },
      data: {
        ...updateDto,
        ...(slug && { slug }),
      },
      include: {
        category: true,
        building: true,
        photos: true,
        availability: true,
      },
    });
  }

  /**
   * Soft delete listing
   */
  async remove(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Verify ownership
    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only delete your own listings');
    }

    // Soft delete by setting status to EXPIRED
    return this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.EXPIRED },
    });
  }

  /**
   * Publish a draft listing
   */
  async publish(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only publish your own listings');
    }

    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be published');
    }

    // Check if building requires moderation
    const building = await this.prisma.building.findUnique({
      where: { id: listing.buildingId },
    });

    const newStatus = building?.status === 'ACTIVE'
      ? ListingStatus.ACTIVE
      : ListingStatus.PENDING_APPROVAL;

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === ListingStatus.ACTIVE && { publishedAt: new Date() }),
      },
      include: {
        category: true,
        photos: true,
      },
    });
  }

  /**
   * Pause an active listing
   */
  async pause(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only pause your own listings');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be paused');
    }

    return this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.PAUSED },
    });
  }

  /**
   * Reactivate a paused listing
   */
  async activate(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only activate your own listings');
    }

    if (listing.status !== ListingStatus.PAUSED) {
      throw new BadRequestException('Only paused listings can be activated');
    }

    return this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.ACTIVE },
    });
  }

  /**
   * Get pending listings for moderation (Building Admin)
   */
  async getPendingListings(buildingId: string) {
    return this.prisma.listing.findMany({
      where: {
        buildingId,
        status: ListingStatus.PENDING_APPROVAL,
      },
      include: {
        category: true,
        seller: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        photos: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Approve a listing (Building Admin)
   */
  async approveListing(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== ListingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending listings can be approved');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.ACTIVE,
        publishedAt: new Date(),
      },
      include: {
        category: true,
        seller: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Reject a listing (Building Admin)
   */
  async rejectListing(id: string, reason: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== ListingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending listings can be rejected');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.REJECTED,
        // Store rejection reason in description or create a separate field
      },
      include: {
        seller: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Toggle save/unsave listing (favorite)
   */
  async toggleSaveListing(userId: string, listingId: string) {
    // Check if listing exists
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Check if already saved
    const existing = await this.prisma.savedListing.findUnique({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });

    if (existing) {
      // Unsave
      await this.prisma.savedListing.delete({
        where: {
          userId_listingId: {
            userId,
            listingId,
          },
        },
      });
      return { saved: false, message: 'Listing removed from favorites' };
    } else {
      // Save
      await this.prisma.savedListing.create({
        data: {
          userId,
          listingId,
        },
      });
      return { saved: true, message: 'Listing added to favorites' };
    }
  }

  /**
   * Get user's saved listings
   */
  async getSavedListings(userId: string, buildingId?: string) {
    const savedListings = await this.prisma.savedListing.findMany({
      where: {
        userId,
        ...(buildingId && {
          listing: {
            buildingId,
          },
        }),
      },
      include: {
        listing: {
          include: {
            category: true,
            building: {
              select: {
                id: true,
                name: true,
              },
            },
            seller: {
              select: {
                id: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            photos: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    });

    return savedListings.map((sl) => sl.listing);
  }

  /**
   * Track listing view
   */
  async trackView(userId: string | null, listingId: string) {
    // Check if listing exists
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return;
    }

    // Create view record (if user is authenticated)
    if (userId) {
      await this.prisma.listingView.create({
        data: {
          userId,
          listingId,
        },
      });
    }

    // Increment view count
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });
  }

  /**
   * Get listing availability
   */
  async getAvailability(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { availability: { orderBy: { dayOfWeek: 'asc' } } },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing.availability;
  }

  /**
   * Update listing availability (for service listings)
   */
  async updateAvailability(
    listingId: string,
    userId: string,
    availability: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Verify ownership
    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    // Validate time slots
    for (const slot of availability) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException('Start time must be before end time');
      }
    }

    // Delete existing availability and create new ones
    await this.prisma.listingAvailability.deleteMany({
      where: { listingId },
    });

    if (availability.length > 0) {
      await this.prisma.listingAvailability.createMany({
        data: availability.map((slot) => ({
          listingId,
          ...slot,
        })),
      });
    }

    return this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { availability: { orderBy: { dayOfWeek: 'asc' } } },
    });
  }

  /**
   * Generate URL-friendly slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100) + '-' + Date.now();
  }
}
