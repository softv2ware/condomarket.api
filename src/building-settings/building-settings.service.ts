import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { CacheService } from '../common/cache/cache.service';
import { UpdateBuildingSettingsDto } from './dto/update-building-settings.dto';
import { BuildingSettingsEntity } from './entities/building-settings.entity';
import { ReportStatus } from '@prisma/client';

@Injectable()
export class BuildingSettingsService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get building settings (creates default if not exists)
   */
  async getSettings(buildingId: string): Promise<BuildingSettingsEntity> {
    return this.cacheService.wrap(
      `building-settings:${buildingId}`,
      async () => {
        // Check if building exists
        const building = await this.prisma.building.findUnique({
          where: { id: buildingId },
        });

        if (!building) {
          throw new NotFoundException('Building not found');
        }

        // Get or create settings
        let settings = await this.prisma.buildingSettings.findUnique({
          where: { buildingId },
        });

        if (!settings) {
          // Create default settings
          settings = await this.prisma.buildingSettings.create({
            data: {
              buildingId,
              requireListingApproval: false,
              allowedCategories: [],
              maxListingsPerSeller: 10,
              autoModeration: true,
              autoHideThreshold: 3,
            },
          });
        }

        return new BuildingSettingsEntity(settings);
      },
      1800, // 30 minutes TTL - settings rarely change
    );
  }

  /**
   * Update building settings (Building Admin only)
   */
  async updateSettings(
    buildingId: string,
    userId: string,
    dto: UpdateBuildingSettingsDto,
  ): Promise<BuildingSettingsEntity> {
    // Check if user is building admin
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Check if user is building admin (you can also check user role)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, managedBuildings: { select: { id: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is BUILDING_ADMIN or PLATFORM_ADMIN
    if (user.role !== 'BUILDING_ADMIN' && user.role !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException('Only building or platform admins can update settings');
    }

    // For building admins, check they manage this building
    if (user.role === 'BUILDING_ADMIN') {
      const managesBuilding = user.managedBuildings.some((b) => b.id === buildingId);
      if (!managesBuilding) {
        throw new ForbiddenException('Can only update settings for buildings you manage');
      }
    }

    // Get or create settings
    let settings = await this.prisma.buildingSettings.findUnique({
      where: { buildingId },
    });

    if (!settings) {
      settings = await this.prisma.buildingSettings.create({
        data: {
          buildingId,
          requireListingApproval: dto.requireListingApproval ?? false,
          allowedCategories: dto.allowedCategories ?? [],
          maxListingsPerSeller: dto.maxListingsPerSeller ?? 10,
          autoModeration: dto.autoModeration ?? true,
          autoHideThreshold: dto.autoHideThreshold ?? 3,
        },
      });
    } else {
      settings = await this.prisma.buildingSettings.update({
        where: { buildingId },
        data: dto,
      });
    }

    // Invalidate cache after update
    await this.cacheService.del(`building-settings:${buildingId}`);

    return new BuildingSettingsEntity(settings);
  }

  /**
   * Get moderation statistics for a building
   */
  async getModerationStats(buildingId: string): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    totalModerationActions: number;
    activeRestrictions: number;
    flaggedContent: number;
  }> {
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    const [
      totalReports,
      pendingReports,
      resolvedReports,
      totalModerationActions,
      activeRestrictions,
      flaggedListings,
      flaggedReviews,
    ] = await Promise.all([
      // Total reports
      this.prisma.report.count({
        where: { buildingId },
      }),
      // Pending reports
      this.prisma.report.count({
        where: { buildingId, status: ReportStatus.PENDING },
      }),
      // Resolved reports
      this.prisma.report.count({
        where: { buildingId, status: ReportStatus.RESOLVED },
      }),
      // Total moderation actions
      this.prisma.moderationAction.count({
        where: { buildingId },
      }),
      // Active restrictions
      this.prisma.moderationAction.count({
        where: {
          buildingId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      }),
      // Flagged listings
      this.prisma.listing.count({
        where: { buildingId, status: 'PAUSED' },
      }),
      // Flagged reviews (reviews don't have buildingId, so we skip this or query differently)
      Promise.resolve(0),
    ]);

    return {
      totalReports,
      pendingReports,
      resolvedReports,
      totalModerationActions,
      activeRestrictions,
      flaggedContent: flaggedListings + flaggedReviews,
    };
  }
}
