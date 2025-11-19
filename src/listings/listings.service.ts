import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { SellerSubscriptionsService } from '../seller-subscriptions/seller-subscriptions.service';
import { S3Service } from '../common/s3/s3.service';
import { CacheService } from '../common/cache/cache.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { ListingStatus } from '@prisma/client';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SellerSubscriptionsService,
    private readonly s3Service: S3Service,
    private readonly cacheService: CacheService,
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

    // If search query is provided, use full-text search
    if (q && q.trim().length > 0) {
      return this.searchWithFullText(searchDto);
    }

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
   * Search listings with PostgreSQL full-text search
   */
  async searchWithFullText(searchDto: SearchListingsDto) {
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

    if (!q || q.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    // Prepare search query for PostgreSQL full-text search
    const searchTerms = q
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `${term}:*`)
      .join(' & ');

    // Build WHERE clause for filters
    const filters: string[] = [`l.status = $1`];
    const params: any[] = [status];
    let paramIndex = 2;

    if (type) {
      filters.push(`l.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (categoryId) {
      filters.push(`l."categoryId" = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    }

    if (buildingId) {
      filters.push(`l."buildingId" = $${paramIndex}`);
      params.push(buildingId);
      paramIndex++;
    }

    if (minPrice !== undefined) {
      filters.push(`l.price >= $${paramIndex}`);
      params.push(minPrice);
      paramIndex++;
    }

    if (maxPrice !== undefined) {
      filters.push(`l.price <= $${paramIndex}`);
      params.push(maxPrice);
      paramIndex++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Full-text search query
    const searchQuery = `
      SELECT 
        l.*,
        ts_rank(
          to_tsvector('english', l.title || ' ' || l.description),
          to_tsquery('english', $${paramIndex})
        ) as relevance
      FROM listings l
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} to_tsvector('english', l.title || ' ' || l.description) @@ to_tsquery('english', $${paramIndex})
      ORDER BY 
        CASE l."subscriptionTierSnapshot"
          WHEN 'PREMIUM' THEN 3
          WHEN 'STANDARD' THEN 2
          WHEN 'FREE' THEN 1
          ELSE 0
        END DESC,
        relevance DESC,
        l."publishedAt" DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(searchTerms, limit, skip);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM listings l
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} to_tsvector('english', l.title || ' ' || l.description) @@ to_tsquery('english', $${paramIndex})
    `;

    const countParams = [...params.slice(0, paramIndex - 1), searchTerms];

    try {
      const [searchResults, countResult] = await Promise.all([
        this.prisma.$queryRawUnsafe(searchQuery, ...params),
        this.prisma.$queryRawUnsafe(countQuery, ...countParams),
      ]);

      const listingIds = (searchResults as any[]).map((r) => r.id);

      // Fetch full listing data with relations
      const listings = await this.prisma.listing.findMany({
        where: { id: { in: listingIds } },
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
      });

      // Sort listings by the order from search results
      const listingMap = new Map(listings.map((l) => [l.id, l]));
      const sortedListings = listingIds
        .map((id) => listingMap.get(id))
        .filter((l) => l !== undefined);

      const total = parseInt((countResult as any[])[0]?.total || '0');

      return {
        data: sortedListings,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          searchTerms: q,
        },
      };
    } catch (error) {
      // Fallback to basic search if full-text search fails
      console.error('Full-text search error:', error);
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
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
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
            { subscriptionTierSnapshot: 'desc' },
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
    // Don't cache if we need to increment view count
    if (incrementView) {
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

      await this.prisma.listing.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });

      return listing;
    }

    // Cache for 10 minutes (600s) for read-only requests
    return this.cacheService.wrap(
      `listing:${id}`,
      async () => {
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

        return listing;
      },
      600, // 10 minutes TTL
    );
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
   * Upload photos for a listing
   */
  async uploadPhotos(
    listingId: string,
    userId: string,
    files: Express.Multer.File[],
    isMain: boolean = false,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { photos: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Verify ownership
    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only upload photos to your own listings');
    }

    // Check max photos limit (10)
    const maxPhotos = 10;
    if (listing.photos.length + files.length > maxPhotos) {
      throw new BadRequestException(
        `Maximum ${maxPhotos} photos allowed per listing. Current: ${listing.photos.length}`,
      );
    }

    // Validate file types and sizes
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP`,
        );
      }
      if (file.size > maxFileSize) {
        throw new BadRequestException(
          `File size exceeds 5MB limit: ${file.originalname}`,
        );
      }
    }

    // Upload files to S3
    const uploadedUrls = await this.s3Service.uploadFiles(files, `listings/${listingId}`);

    // If this is marked as main, unset existing main photo
    if (isMain && listing.photos.length > 0) {
      await this.prisma.listingPhoto.updateMany({
        where: { listingId, isMain: true },
        data: { isMain: false },
      });
    }

    // Create photo records
    const nextOrder = listing.photos.length > 0
      ? Math.max(...listing.photos.map((p) => p.order)) + 1
      : 0;

    const photoRecords = uploadedUrls.map((url, index) => ({
      listingId,
      url,
      order: nextOrder + index,
      isMain: isMain && index === 0, // Only first photo is main if specified
    }));

    await this.prisma.listingPhoto.createMany({
      data: photoRecords,
    });

    return this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { photos: { orderBy: { order: 'asc' } } },
    });
  }

  /**
   * Delete a photo from a listing
   */
  async deletePhoto(photoId: string, userId: string) {
    const photo = await this.prisma.listingPhoto.findUnique({
      where: { id: photoId },
      include: { listing: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Verify ownership
    if (photo.listing.sellerId !== userId) {
      throw new ForbiddenException('You can only delete photos from your own listings');
    }

    // Delete from S3
    await this.s3Service.deleteFile(photo.url);

    // Delete from database
    await this.prisma.listingPhoto.delete({
      where: { id: photoId },
    });

    return { message: 'Photo deleted successfully' };
  }

  /**
   * Set a photo as main
   */
  async setMainPhoto(photoId: string, userId: string) {
    const photo = await this.prisma.listingPhoto.findUnique({
      where: { id: photoId },
      include: { listing: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Verify ownership
    if (photo.listing.sellerId !== userId) {
      throw new ForbiddenException('You can only modify photos from your own listings');
    }

    // Unset existing main photo
    await this.prisma.listingPhoto.updateMany({
      where: { listingId: photo.listingId, isMain: true },
      data: { isMain: false },
    });

    // Set new main photo
    return this.prisma.listingPhoto.update({
      where: { id: photoId },
      data: { isMain: true },
    });
  }

  /**
   * Reorder photos
   */
  async reorderPhotos(
    listingId: string,
    userId: string,
    photoOrders: Array<{ photoId: string; order: number }>,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Verify ownership
    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only reorder photos from your own listings');
    }

    // Update photo orders
    await Promise.all(
      photoOrders.map(({ photoId, order }) =>
        this.prisma.listingPhoto.updateMany({
          where: { id: photoId, listingId },
          data: { order },
        }),
      ),
    );

    return this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { photos: { orderBy: { order: 'asc' } } },
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
