import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '~/prisma';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CategoryType } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    building: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'Electronics',
      slug: 'electronics',
      type: CategoryType.PRODUCT,
      description: 'Electronic devices',
      icon: '📱',
    };

    it('should create a category successfully', async () => {
      const mockCategory = {
        id: 'category-1',
        ...createDto,
      };

      mockPrismaService.category.create.mockResolvedValue(mockCategory);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.category.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when parent category does not exist', async () => {
      const dtoWithParent = {
        ...createDto,
        parentId: 'non-existent',
      };

      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithParent)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when parent and child types mismatch', async () => {
      const dtoWithParent = {
        ...createDto,
        parentId: 'parent-1',
        type: CategoryType.PRODUCT,
      };

      mockPrismaService.category.findUnique.mockResolvedValue({
        id: 'parent-1',
        type: CategoryType.SERVICE, // Different type
      });

      await expect(service.create(dtoWithParent)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when building does not exist', async () => {
      const dtoWithBuilding = {
        ...createDto,
        buildingId: 'non-existent',
      };

      mockPrismaService.building.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithBuilding)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        {
          id: 'category-1',
          name: 'Electronics',
          type: CategoryType.PRODUCT,
        },
        {
          id: 'category-2',
          name: 'Furniture',
          type: CategoryType.PRODUCT,
        },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll();

      expect(result).toEqual(mockCategories);
      expect(mockPrismaService.category.findMany).toHaveBeenCalled();
    });

    it('should filter by type', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([]);

      await service.findAll(CategoryType.PRODUCT);

      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: CategoryType.PRODUCT,
          }),
        }),
      );
    });

    it('should filter by buildingId', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([]);

      await service.findAll(undefined, 'building-1');

      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ buildingId: 'building-1' }, { buildingId: null }],
          }),
        }),
      );
    });
  });

  describe('getCategoryTree', () => {
    it('should return hierarchical category tree', async () => {
      const mockTree = [
        {
          id: 'category-1',
          name: 'Electronics',
          parentId: null,
          children: [
            {
              id: 'category-2',
              name: 'Laptops',
              parentId: 'category-1',
            },
          ],
        },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(mockTree);

      const result = await service.getCategoryTree();

      expect(result).toEqual(mockTree);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: null,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a category by ID', async () => {
      const mockCategory = {
        id: 'category-1',
        name: 'Electronics',
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne('category-1');

      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Electronics',
      description: 'Updated description',
    };

    it('should update a category successfully', async () => {
      const mockCategory = {
        id: 'category-1',
        name: 'Electronics',
        type: CategoryType.PRODUCT,
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.update.mockResolvedValue({
        ...mockCategory,
        ...updateDto,
      });

      const result = await service.update('category-1', updateDto);

      expect(result.name).toBe('Updated Electronics');
      expect(mockPrismaService.category.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when category is its own parent', async () => {
      const mockCategory = {
        id: 'category-1',
        type: CategoryType.PRODUCT,
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      await expect(
        service.update('category-1', { parentId: 'category-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when parent category does not exist', async () => {
      const mockCategory = {
        id: 'category-1',
        type: CategoryType.PRODUCT,
      };

      mockPrismaService.category.findUnique
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(null);

      await expect(
        service.update('category-1', { parentId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when parent type mismatches', async () => {
      const mockCategory = {
        id: 'category-1',
        type: CategoryType.PRODUCT,
      };

      const mockParent = {
        id: 'parent-1',
        type: CategoryType.SERVICE,
      };

      mockPrismaService.category.findUnique
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(mockParent);

      await expect(
        service.update('category-1', { parentId: 'parent-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a category successfully', async () => {
      const mockCategory = {
        id: 'category-1',
        _count: {
          listings: 0,
          children: 0,
        },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await service.remove('category-1');

      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 'category-1' },
      });
    });

    it('should throw BadRequestException when category has listings', async () => {
      const mockCategory = {
        id: 'category-1',
        _count: {
          listings: 5,
          children: 0,
        },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      await expect(service.remove('category-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when category has subcategories', async () => {
      const mockCategory = {
        id: 'category-1',
        _count: {
          listings: 0,
          children: 2,
        },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      await expect(service.remove('category-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
