import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from './listings.service';
import { PrismaService } from '~/prisma';
import { SellerSubscriptionsService } from '../seller-subscriptions/seller-subscriptions.service';
import { S3Service } from '../common/s3/s3.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ListingStatus, ListingType, SubscriptionTier, CategoryType, AvailabilityType } from '@prisma/client';

describe('ListingsService', () => {
  let service: ListingsService;
  let prisma: PrismaService;
  let subscriptionsService: SellerSubscriptionsService;
  let s3Service: S3Service;

  const mockPrismaService = {
    listing: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    building: {
      findUnique: jest.fn(),
    },
    listingPhoto: {
      findUnique: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    listingView: {
      create: jest.fn(),
    },
    savedListing: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    listingAvailability: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const mockSubscriptionsService = {
    canCreateListing: jest.fn(),
    getActiveSubscriptionForBuilding: jest.fn(),
  };

  const mockS3Service = {
    uploadFile: jest.fn(),
    uploadFiles: jest.fn(),
    deleteFile: jest.fn(),
    deleteFiles: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SellerSubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    prisma = module.get<PrismaService>(PrismaService);
    subscriptionsService = module.get<SellerSubscriptionsService>(SellerSubscriptionsService);
    s3Service = module.get<S3Service>(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createListingDto = {
      type: ListingType.PRODUCT,
      title: 'Test Product',
      description: 'Test Description',
      categoryId: 'category-1',
      buildingId: 'building-1',
      price: 100,
      currency: 'USD',
      availabilityType: AvailabilityType.ALWAYS,
      deliveryAvailable: true,
    };

    const userId = 'user-1';

    it('should create a listing successfully', async () => {
      mockSubscriptionsService.canCreateListing.mockResolvedValue({
        canCreate: true,
        currentCount: 0,
        maxListings: 10,
      });

      mockPrismaService.category.findUnique.mockResolvedValue({
        id: 'category-1',
        name: 'Electronics',
        type: CategoryType.PRODUCT,
      });

      mockPrismaService.building.findUnique.mockResolvedValue({
        id: 'building-1',
        name: 'Test Building',
      });

      mockSubscriptionsService.getActiveSubscriptionForBuilding.mockResolvedValue({
        plan: { tier: SubscriptionTier.STANDARD },
      });

      const mockListing = {
        id: 'listing-1',
        ...createListingDto,
        sellerId: userId,
        slug: 'test-product-123456',
        status: ListingStatus.DRAFT,
        subscriptionTierSnapshot: SubscriptionTier.STANDARD,
      };

      mockPrismaService.listing.create.mockResolvedValue(mockListing);

      const result = await service.create(userId, createListingDto);

      expect(result).toEqual(mockListing);
      expect(mockSubscriptionsService.canCreateListing).toHaveBeenCalledWith(
        userId,
        createListingDto.buildingId,
      );
      expect(mockPrismaService.listing.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when listing limit is reached', async () => {
      mockSubscriptionsService.canCreateListing.mockResolvedValue({
        canCreate: false,
        reason: 'Listing limit reached',
        currentCount: 1,
        maxListings: 1,
      });

      await expect(service.create(userId, createListingDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.listing.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockSubscriptionsService.canCreateListing.mockResolvedValue({
        canCreate: true,
      });

      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createListingDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when building does not exist', async () => {
      mockSubscriptionsService.canCreateListing.mockResolvedValue({
        canCreate: true,
      });

      mockPrismaService.category.findUnique.mockResolvedValue({
        id: 'category-1',
      });

      mockPrismaService.building.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createListingDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated listings', async () => {
      const mockListings = [
        {
          id: 'listing-1',
          title: 'Product 1',
          status: ListingStatus.ACTIVE,
        },
        {
          id: 'listing-2',
          title: 'Product 2',
          status: ListingStatus.ACTIVE,
        },
      ];

      mockPrismaService.listing.findMany.mockResolvedValue(mockListings);
      mockPrismaService.listing.count.mockResolvedValue(2);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        status: ListingStatus.ACTIVE,
      });

      expect(result.data).toEqual(mockListings);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by type', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([]);
      mockPrismaService.listing.count.mockResolvedValue(0);

      await service.findAll({
        type: ListingType.PRODUCT,
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: ListingType.PRODUCT,
          }),
        }),
      );
    });

    it('should filter by price range', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([]);
      mockPrismaService.listing.count.mockResolvedValue(0);

      await service.findAll({
        minPrice: 10,
        maxPrice: 100,
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: {
              gte: 10,
              lte: 100,
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a listing by ID', async () => {
      const mockListing = {
        id: 'listing-1',
        title: 'Test Listing',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.listing.update.mockResolvedValue(mockListing);

      const result = await service.findOne('listing-1', true);

      expect(result).toEqual(mockListing);
      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const userId = 'user-1';
    const listingId = 'listing-1';

    it('should update a listing successfully', async () => {
      const mockListing = {
        id: listingId,
        sellerId: userId,
        title: 'Old Title',
      };

      const updateDto = {
        title: 'New Title',
        price: 150,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.listing.update.mockResolvedValue({
        ...mockListing,
        ...updateDto,
      });

      const result = await service.update(listingId, userId, updateDto);

      expect(result.title).toBe('New Title');
      expect(mockPrismaService.listing.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      const mockListing = {
        id: listingId,
        sellerId: 'other-user',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);

      await expect(service.update(listingId, userId, { title: 'New' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('publish', () => {
    const userId = 'user-1';
    const listingId = 'listing-1';

    it('should publish a draft listing', async () => {
      const mockListing = {
        id: listingId,
        sellerId: userId,
        status: ListingStatus.DRAFT,
        buildingId: 'building-1',
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.building.findUnique.mockResolvedValue({
        id: 'building-1',
        status: 'ACTIVE',
      });
      mockPrismaService.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.ACTIVE,
      });

      const result = await service.publish(listingId, userId);

      expect(result.status).toBe(ListingStatus.ACTIVE);
    });

    it('should throw BadRequestException when listing is not draft', async () => {
      const mockListing = {
        id: listingId,
        sellerId: userId,
        status: ListingStatus.ACTIVE,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);

      await expect(service.publish(listingId, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('pause', () => {
    const userId = 'user-1';
    const listingId = 'listing-1';

    it('should pause an active listing', async () => {
      const mockListing = {
        id: listingId,
        sellerId: userId,
        status: ListingStatus.ACTIVE,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.PAUSED,
      });

      const result = await service.pause(listingId, userId);

      expect(result.status).toBe(ListingStatus.PAUSED);
    });

    it('should throw BadRequestException when listing is not active', async () => {
      const mockListing = {
        id: listingId,
        sellerId: userId,
        status: ListingStatus.DRAFT,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);

      await expect(service.pause(listingId, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('activate', () => {
    const userId = 'user-1';
    const listingId = 'listing-1';

    it('should activate a paused listing', async () => {
      const mockListing = {
        id: listingId,
        sellerId: userId,
        status: ListingStatus.PAUSED,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.ACTIVE,
      });

      const result = await service.activate(listingId, userId);

      expect(result.status).toBe(ListingStatus.ACTIVE);
    });
  });

  describe('approveListing', () => {
    it('should approve a pending listing', async () => {
      const mockListing = {
        id: 'listing-1',
        status: ListingStatus.PENDING_APPROVAL,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.ACTIVE,
      });

      const result = await service.approveListing('listing-1');

      expect(result.status).toBe(ListingStatus.ACTIVE);
    });

    it('should throw BadRequestException when listing is not pending', async () => {
      const mockListing = {
        id: 'listing-1',
        status: ListingStatus.ACTIVE,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);

      await expect(service.approveListing('listing-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectListing', () => {
    it('should reject a pending listing', async () => {
      const mockListing = {
        id: 'listing-1',
        status: ListingStatus.PENDING_APPROVAL,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.REJECTED,
      });

      const result = await service.rejectListing('listing-1', 'Invalid content');

      expect(result.status).toBe(ListingStatus.REJECTED);
    });
  });

  describe('toggleSaveListing', () => {
    const userId = 'user-1';
    const listingId = 'listing-1';

    it('should save a listing', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
      });
      mockPrismaService.savedListing.findUnique.mockResolvedValue(null);
      mockPrismaService.savedListing.create.mockResolvedValue({
        userId,
        listingId,
      });

      const result = await service.toggleSaveListing(userId, listingId);

      expect(result.saved).toBe(true);
      expect(mockPrismaService.savedListing.create).toHaveBeenCalled();
    });

    it('should unsave a listing', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
      });
      mockPrismaService.savedListing.findUnique.mockResolvedValue({
        userId,
        listingId,
      });
      mockPrismaService.savedListing.delete.mockResolvedValue({
        userId,
        listingId,
      });

      const result = await service.toggleSaveListing(userId, listingId);

      expect(result.saved).toBe(false);
      expect(mockPrismaService.savedListing.delete).toHaveBeenCalled();
    });
  });

  describe('uploadPhotos', () => {
    const userId = 'user-1';
    const listingId = 'listing-1';

    it('should upload photos successfully', async () => {
      const mockFiles = [
        {
          mimetype: 'image/jpeg',
          size: 1024 * 1024, // 1MB
          originalname: 'test.jpg',
          buffer: Buffer.from('test'),
        } as Express.Multer.File,
      ];

      mockPrismaService.listing.findUnique
        .mockResolvedValueOnce({
          id: listingId,
          sellerId: userId,
          photos: [],
        })
        .mockResolvedValueOnce({
          id: listingId,
          photos: [{ url: 'https://s3.amazonaws.com/test.jpg' }],
        });

      mockS3Service.uploadFiles.mockResolvedValue(['https://s3.amazonaws.com/test.jpg']);
      mockPrismaService.listingPhoto.createMany.mockResolvedValue({ count: 1 });

      const result = await service.uploadPhotos(listingId, userId, mockFiles);

      expect(mockS3Service.uploadFiles).toHaveBeenCalled();
      expect(mockPrismaService.listingPhoto.createMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException when exceeding photo limit', async () => {
      const mockFiles = Array(11).fill({
        mimetype: 'image/jpeg',
        size: 1024,
      });

      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
        sellerId: userId,
        photos: [],
      });

      await expect(service.uploadPhotos(listingId, userId, mockFiles as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid file type', async () => {
      const mockFiles = [
        {
          mimetype: 'application/pdf',
          size: 1024,
          originalname: 'test.pdf',
        } as Express.Multer.File,
      ];

      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
        sellerId: userId,
        photos: [],
      });

      await expect(service.uploadPhotos(listingId, userId, mockFiles)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for file size exceeding limit', async () => {
      const mockFiles = [
        {
          mimetype: 'image/jpeg',
          size: 10 * 1024 * 1024, // 10MB
          originalname: 'test.jpg',
        } as Express.Multer.File,
      ];

      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
        sellerId: userId,
        photos: [],
      });

      await expect(service.uploadPhotos(listingId, userId, mockFiles)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deletePhoto', () => {
    const userId = 'user-1';
    const photoId = 'photo-1';

    it('should delete a photo successfully', async () => {
      mockPrismaService.listingPhoto.findUnique.mockResolvedValue({
        id: photoId,
        url: 'https://s3.amazonaws.com/test.jpg',
        listing: {
          sellerId: userId,
        },
      });

      mockS3Service.deleteFile.mockResolvedValue(undefined);
      mockPrismaService.listingPhoto.delete.mockResolvedValue({
        id: photoId,
      });

      const result = await service.deletePhoto(photoId, userId);

      expect(result.message).toBe('Photo deleted successfully');
      expect(mockS3Service.deleteFile).toHaveBeenCalled();
      expect(mockPrismaService.listingPhoto.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      mockPrismaService.listingPhoto.findUnique.mockResolvedValue({
        id: photoId,
        listing: {
          sellerId: 'other-user',
        },
      });

      await expect(service.deletePhoto(photoId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateAvailability', () => {
    const userId = 'user-1';
    const listingId = 'listing-1';

    it('should update availability successfully', async () => {
      const availability = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      ];

      mockPrismaService.listing.findUnique.mockResolvedValueOnce({
        id: listingId,
        sellerId: userId,
      });

      mockPrismaService.listingAvailability.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.listingAvailability.createMany.mockResolvedValue({ count: 2 });

      mockPrismaService.listing.findUnique.mockResolvedValueOnce({
        id: listingId,
        availability,
      });

      const result = await service.updateAvailability(listingId, userId, availability);

      expect(mockPrismaService.listingAvailability.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.listingAvailability.createMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid time slots', async () => {
      const availability = [
        { dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }, // Invalid: start > end
      ];

      mockPrismaService.listing.findUnique.mockResolvedValue({
        id: listingId,
        sellerId: userId,
      });

      await expect(
        service.updateAvailability(listingId, userId, availability),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
