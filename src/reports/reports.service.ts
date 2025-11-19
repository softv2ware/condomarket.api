import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { CreateReportDto } from './dto/create-report.dto';
import { GetReportsDto } from './dto/get-reports.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReportEntity } from './entities/report.entity';
import { ReportStatus, Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new report
   */
  async create(
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<ReportEntity> {
    // Check if entity exists based on type
    await this.validateEntity(dto.entityType, dto.entityId);

    // Check for duplicate reports (same reporter, same entity, within last 24h)
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingReport) {
      throw new BadRequestException(
        'You have already reported this content recently',
      );
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportType: dto.reportType,
        entityType: dto.entityType,
        entityId: dto.entityId,
        reason: dto.reason,
        description: dto.description,
        buildingId: dto.buildingId,
      },
    });

    // Check if auto-hide threshold reached
    await this.checkAutoHideThreshold(
      dto.entityType,
      dto.entityId,
      dto.buildingId,
    );

    return new ReportEntity(report);
  }

  /**
   * Get reports created by user
   */
  async getMyReports(userId: string, dto: GetReportsDto) {
    const { reportType, status, entityType, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {
      reporterId: userId,
    };

    if (reportType) where.reportType = reportType;
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reviewer: {
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
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports: reports.map((r) => new ReportEntity(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get report by ID
   */
  async getReport(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<ReportEntity> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: {
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
        reviewer: {
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

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Only reporter or admins can view
    const isAdmin =
      userRole === 'PLATFORM_ADMIN' || userRole === 'BUILDING_ADMIN';
    if (report.reporterId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to view this report',
      );
    }

    return new ReportEntity(report);
  }

  /**
   * Get all reports (Admin only)
   */
  async getAllReports(dto: GetReportsDto, buildingId?: string) {
    const { reportType, status, entityType, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {};

    if (reportType) where.reportType = reportType;
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;
    if (buildingId) where.buildingId = buildingId;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reporter: {
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
          reviewer: {
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
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports: reports.map((r) => new ReportEntity(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get pending reports (Admin only)
   */
  async getPendingReports(buildingId?: string) {
    const where: Prisma.ReportWhereInput = {
      status: ReportStatus.PENDING,
    };

    if (buildingId) {
      where.buildingId = buildingId;
    }

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'asc' }, // Oldest first
      include: {
        reporter: {
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

    return reports.map((r) => new ReportEntity(r));
  }

  /**
   * Review a report (Admin only)
   */
  async reviewReport(
    id: string,
    reviewerId: string,
    dto: ReviewReportDto,
  ): Promise<ReportEntity> {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report has already been reviewed');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.UNDER_REVIEW,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        resolution: dto.resolution,
      },
    });

    return new ReportEntity(updated);
  }

  /**
   * Resolve a report (Admin only)
   */
  async resolveReport(
    id: string,
    reviewerId: string,
    dto: ReviewReportDto,
  ): Promise<ReportEntity> {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        resolution: dto.resolution,
      },
    });

    return new ReportEntity(updated);
  }

  /**
   * Escalate a report to Platform Admin
   */
  async escalateReport(id: string): Promise<ReportEntity> {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.ESCALATED,
      },
    });

    return new ReportEntity(updated);
  }

  /**
   * Dismiss a report (Admin only)
   */
  async dismissReport(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<ReportEntity> {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.DISMISSED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        resolution: reason,
      },
    });

    return new ReportEntity(updated);
  }

  /**
   * Validate that the reported entity exists
   */
  private async validateEntity(
    entityType: string,
    entityId: string,
  ): Promise<void> {
    let exists = false;

    switch (entityType.toLowerCase()) {
      case 'listing':
        exists = !!(await this.prisma.listing.findUnique({
          where: { id: entityId },
        }));
        break;
      case 'user':
        exists = !!(await this.prisma.user.findUnique({
          where: { id: entityId },
        }));
        break;
      case 'review':
        exists = !!(await this.prisma.review.findUnique({
          where: { id: entityId },
        }));
        break;
      case 'message':
        exists = !!(await this.prisma.message.findUnique({
          where: { id: entityId },
        }));
        break;
      case 'order':
        exists = !!(await this.prisma.order.findUnique({
          where: { id: entityId },
        }));
        break;
      case 'booking':
        exists = !!(await this.prisma.booking.findUnique({
          where: { id: entityId },
        }));
        break;
      default:
        throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    if (!exists) {
      throw new NotFoundException(`${entityType} not found`);
    }
  }

  /**
   * Check if auto-hide threshold is reached
   */
  private async checkAutoHideThreshold(
    entityType: string,
    entityId: string,
    buildingId?: string,
  ): Promise<void> {
    // Get building settings if building-scoped
    let threshold = 3; // Default threshold

    if (buildingId) {
      const settings = await this.prisma.buildingSettings.findUnique({
        where: { buildingId },
      });

      if (settings && settings.autoModeration) {
        threshold = settings.autoHideThreshold;
      }
    }

    // Count reports for this entity
    const reportCount = await this.prisma.report.count({
      where: {
        entityType,
        entityId,
        status: {
          in: [ReportStatus.PENDING, ReportStatus.UNDER_REVIEW],
        },
      },
    });

    // If threshold reached, auto-hide the content
    if (reportCount >= threshold) {
      await this.autoHideContent(entityType, entityId);
    }
  }

  /**
   * Auto-hide content that has reached report threshold
   */
  private async autoHideContent(
    entityType: string,
    entityId: string,
  ): Promise<void> {
    try {
      switch (entityType.toLowerCase()) {
        case 'listing':
          await this.prisma.listing.update({
            where: { id: entityId },
            data: { status: 'PAUSED' }, // Temporarily hide
          });
          break;
        case 'review':
          await this.prisma.review.update({
            where: { id: entityId },
            data: { status: 'FLAGGED' }, // Mark as flagged for review
          });
          break;
        // Other entity types can be added as needed
      }
    } catch (error) {
      // Log error but don't throw - auto-hiding is a background action
      console.error(`Failed to auto-hide ${entityType} ${entityId}:`, error);
    }
  }
}
