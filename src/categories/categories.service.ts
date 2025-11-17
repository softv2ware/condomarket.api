import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryType } from '../prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new category (platform-wide or building-specific)
   */
  async create(createDto: CreateCategoryDto) {
    // Validate parent category if provided
    if (createDto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: createDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      // Parent and child must be same type
      if (parent.type !== createDto.type) {
        throw new BadRequestException(
          'Parent and child categories must be of the same type',
        );
      }
    }

    // Validate building if provided
    if (createDto.buildingId) {
      const building = await this.prisma.building.findUnique({
        where: { id: createDto.buildingId },
      });

      if (!building) {
        throw new NotFoundException('Building not found');
      }
    }

    // Generate slug from name
    const slug = this.generateSlug(createDto.name);

    return this.prisma.category.create({
      data: {
        ...createDto,
        slug,
      },
      include: {
        parent: true,
        building: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get all categories with optional filters
   */
  async findAll(type?: CategoryType, buildingId?: string) {
    return this.prisma.category.findMany({
      where: {
        ...(type && { type }),
        ...(buildingId && {
          OR: [
            { buildingId }, // Building-specific
            { buildingId: null }, // Platform-wide
          ],
        }),
      },
      include: {
        parent: true,
        building: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            listings: true,
            children: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get hierarchical category tree
   */
  async getCategoryTree(type?: CategoryType, buildingId?: string) {
    // Get all top-level categories (no parent)
    const topLevel = await this.prisma.category.findMany({
      where: {
        parentId: null,
        ...(type && { type }),
        ...(buildingId && {
          OR: [
            { buildingId },
            { buildingId: null },
          ],
        }),
      },
      include: {
        children: {
          include: {
            _count: {
              select: { listings: true },
            },
          },
        },
        _count: {
          select: { listings: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return topLevel;
  }

  /**
   * Get single category with details
   */
  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          include: {
            _count: {
              select: { listings: true },
            },
          },
        },
        building: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { listings: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /**
   * Update category
   */
  async update(id: string, updateDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Validate parent if being updated
    if (updateDto.parentId) {
      if (updateDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      const parent = await this.prisma.category.findUnique({
        where: { id: updateDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      if (parent.type !== category.type) {
        throw new BadRequestException(
          'Parent and child categories must be of the same type',
        );
      }
    }

    // Update slug if name changed
    const slug = updateDto.name
      ? this.generateSlug(updateDto.name)
      : undefined;

    return this.prisma.category.update({
      where: { id },
      data: {
        ...updateDto,
        ...(slug && { slug }),
      },
      include: {
        parent: true,
        children: true,
        building: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Delete category (only if no listings)
   */
  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            listings: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category._count.listings > 0) {
      throw new BadRequestException(
        'Cannot delete category with active listings',
      );
    }

    if (category._count.children > 0) {
      throw new BadRequestException(
        'Cannot delete category with subcategories',
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
