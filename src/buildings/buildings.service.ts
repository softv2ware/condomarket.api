import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { CacheService } from '../common/cache/cache.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { CreateUnitDto } from './dto/create-unit.dto';

@Injectable()
export class BuildingsService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createBuildingDto: CreateBuildingDto) {
    return this.prisma.building.create({
      data: {
        ...createBuildingDto,
      },
      include: {
        admin: {
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
      },
    });
  }

  async findAll() {
    return this.cacheService.wrap(
      'buildings:all',
      async () => {
        return this.prisma.building.findMany({
          include: {
            admin: {
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
                units: true,
                residents: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      },
      1800, // 30 minutes TTL - buildings rarely change
    );
  }

  async findOne(id: string) {
    return this.cacheService.wrap(
      `building:${id}`,
      async () => {
        const building = await this.prisma.building.findUnique({
          where: { id },
          include: {
            admin: {
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
                units: true,
                residents: true,
              },
            },
          },
        });

        if (!building) {
          throw new NotFoundException(`Building with ID ${id} not found`);
        }

        return building;
      },
      1800, // 30 minutes TTL
    );
  }

  async update(id: string, updateBuildingDto: UpdateBuildingDto) {
    await this.findOne(id); // Check if exists

    const updated = await this.prisma.building.update({
      where: { id },
      data: updateBuildingDto,
      include: {
        admin: {
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
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cacheService.del(`building:${id}`),
      this.cacheService.del('buildings:all'),
    ]);

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists

    const removed = await this.prisma.building.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cacheService.del(`building:${id}`),
      this.cacheService.del('buildings:all'),
    ]);

    return removed;
  }

  // Unit management
  async createUnit(buildingId: string, createUnitDto: CreateUnitDto) {
    // Verify building exists
    await this.findOne(buildingId);

    return this.prisma.unit.create({
      data: {
        buildingId,
        ...createUnitDto,
      },
    });
  }

  async getUnits(buildingId: string) {
    await this.findOne(buildingId); // Check if building exists

    return this.prisma.unit.findMany({
      where: { buildingId },
      include: {
        _count: {
          select: {
            residents: true,
          },
        },
      },
      orderBy: {
        unitNumber: 'asc',
      },
    });
  }

  async getUnit(buildingId: string, unitId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        buildingId,
      },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        residents: {
          include: {
            user: {
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
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found in this building`);
    }

    return unit;
  }

  async canUserAccessBuilding(userId: string, buildingId: string, userRole: string): Promise<boolean> {
    // Platform admins can access all buildings
    if (userRole === 'PLATFORM_ADMIN') {
      return true;
    }

    // Building admins can only access their building
    if (userRole === 'BUILDING_ADMIN') {
      const building = await this.prisma.building.findFirst({
        where: {
          id: buildingId,
          adminId: userId,
        },
      });
      return !!building;
    }

    // Residents can only access their building
    const residence = await this.prisma.residentBuilding.findFirst({
      where: {
        userId,
        buildingId,
        isActive: true,
      },
    });

    return !!residence;
  }
}
