import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '~/prisma';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReportStatus, ReportType, ListingStatus, ReviewStatus } from '@prisma/client';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    report: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    listing: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    buildingSettings: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createReportDto = {
      reportType: ReportType.LISTING,
      entityType: 'listing' as const,
      entityId: 'listing-123',
      reason: 'SPAM' as const,
      description: 'This is spam content',
      buildingId: 'building-123',
    };

    it('should create a report successfully', async () => {
      const userId = 'user-123';
      const mockListing = { id: 'listing-123', buildingId: 'building-123' };
      const mockReport = {
        id: 'report-123',
        ...createReportDto,
        reporterId: userId,
        status: ReportStatus.PENDING,
        createdAt: new Date(),
      };

      mockPrismaService.report.findFirst.mockResolvedValue(null);
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.report.count.mockResolvedValue(2);
      mockPrismaService.buildingSettings.findUnique.mockResolvedValue({ autoHideThreshold: 3 });
      mockPrismaService.report.create.mockResolvedValue(mockReport);

      const result = await service.create(userId, createReportDto);

      expect(result).toBeDefined();
      expect(result.reporterId).toBe(userId);
      expect(mockPrismaService.report.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for duplicate report within 24 hours', async () => {
      const userId = 'user-123';
      const existingReport = {
        id: 'report-123',
        createdAt: new Date(),
      };

      mockPrismaService.report.findFirst.mockResolvedValue(existingReport);

      await expect(service.create(userId, createReportDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for invalid entity', async () => {
      const userId = 'user-123';

      mockPrismaService.report.findFirst.mockResolvedValue(null);
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, createReportDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should auto-hide content when threshold is reached', async () => {
      const userId = 'user-123';
      const mockListing = { id: 'listing-123', buildingId: 'building-123' };
      const mockReport = {
        id: 'report-123',
        ...createReportDto,
        reporterId: userId,
        status: ReportStatus.PENDING,
        createdAt: new Date(),
      };

      mockPrismaService.report.findFirst.mockResolvedValue(null);
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.report.count.mockResolvedValue(3);
      mockPrismaService.buildingSettings.findUnique.mockResolvedValue({ autoHideThreshold: 3 });
      mockPrismaService.listing.update.mockResolvedValue({ ...mockListing, status: ListingStatus.PAUSED });
      mockPrismaService.report.create.mockResolvedValue(mockReport);

      await service.create(userId, createReportDto);

      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-123' },
        data: { status: ListingStatus.PAUSED },
      });
    });
  });

  describe('getMyReports', () => {
    it('should return paginated user reports', async () => {
      const userId = 'user-123';
      const mockReports = [
        { id: 'report-1', reporterId: userId, status: ReportStatus.PENDING },
        { id: 'report-2', reporterId: userId, status: ReportStatus.RESOLVED },
      ];

      mockPrismaService.report.count.mockResolvedValue(2);
      mockPrismaService.report.findMany.mockResolvedValue(mockReports);

      const result = await service.getMyReports(userId, {});

      expect(result.reports).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(mockPrismaService.report.findMany).toHaveBeenCalled();
    });
  });

  describe('getReport', () => {
    it('should return report for owner', async () => {
      const userId = 'user-123';
      const mockReport = {
        id: 'report-123',
        reporterId: userId,
        status: ReportStatus.PENDING,
      };
      const mockUser = { role: 'RESIDENT' };

      mockPrismaService.report.findUnique.mockResolvedValue(mockReport);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getReport('report-123', userId, 'RESIDENT');

      expect(result).toBeDefined();
      expect(result.reporterId).toBe(userId);
    });

    it('should return report for platform admin', async () => {
      const userId = 'admin-123';
      const mockReport = {
        id: 'report-123',
        reporterId: 'other-user',
        status: ReportStatus.PENDING,
        buildingId: 'building-123',
      };
      const mockUser = { role: 'PLATFORM_ADMIN' };

      mockPrismaService.report.findUnique.mockResolvedValue(mockReport);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getReport('report-123', userId, 'PLATFORM_ADMIN');

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for unauthorized access', async () => {
      const userId = 'user-123';
      const mockReport = {
        id: 'report-123',
        reporterId: 'other-user',
        status: ReportStatus.PENDING,
        buildingId: 'building-123',
      };
      const mockUser = { role: 'RESIDENT', managedBuildings: [] };

      mockPrismaService.report.findUnique.mockResolvedValue(mockReport);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.getReport('report-123', userId, 'RESIDENT')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException for non-existent report', async () => {
      mockPrismaService.report.findUnique.mockResolvedValue(null);

      await expect(service.getReport('report-123', 'user-123', 'RESIDENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reviewReport', () => {
    it('should update report status to UNDER_REVIEW', async () => {
      const reportId = 'report-123';
      const reviewerId = 'admin-123';
      const mockReport = {
        id: reportId,
        status: ReportStatus.UNDER_REVIEW,
        reviewerId,
      };

      mockPrismaService.report.findUnique.mockResolvedValue({ id: reportId, status: ReportStatus.PENDING });
      mockPrismaService.report.update.mockResolvedValue(mockReport);

      const result = await service.reviewReport(reportId, reviewerId, { resolution: 'Under review' });

      expect(result.status).toBe(ReportStatus.UNDER_REVIEW);
      expect(mockPrismaService.report.update).toHaveBeenCalled();
    });
  });

  describe('resolveReport', () => {
    it('should resolve report', async () => {
      const reportId = 'report-123';
      const reviewerId = 'admin-123';
      const mockReport = {
        id: reportId,
        status: ReportStatus.RESOLVED,
      };

      mockPrismaService.report.findUnique.mockResolvedValue({ id: reportId, status: ReportStatus.UNDER_REVIEW });
      mockPrismaService.report.update.mockResolvedValue(mockReport);

      const result = await service.resolveReport(reportId, reviewerId, { resolution: 'Resolved' });

      expect(result.status).toBe(ReportStatus.RESOLVED);
    });
  });

  describe('escalateReport', () => {
    it('should escalate report', async () => {
      const reportId = 'report-123';
      const mockReport = {
        id: reportId,
        status: ReportStatus.ESCALATED,
      };

      mockPrismaService.report.findUnique.mockResolvedValue({ id: reportId, status: ReportStatus.UNDER_REVIEW });
      mockPrismaService.report.update.mockResolvedValue(mockReport);

      const result = await service.escalateReport(reportId);

      expect(result.status).toBe(ReportStatus.ESCALATED);
    });
  });

  describe('dismissReport', () => {
    it('should dismiss report', async () => {
      const reportId = 'report-123';
      const reviewerId = 'admin-123';
      const mockReport = {
        id: reportId,
        status: ReportStatus.DISMISSED,
      };

      mockPrismaService.report.findUnique.mockResolvedValue({ id: reportId, status: ReportStatus.PENDING });
      mockPrismaService.report.update.mockResolvedValue(mockReport);

      const result = await service.dismissReport(reportId, reviewerId, 'False alarm');

      expect(result.status).toBe(ReportStatus.DISMISSED);
    });
  });
});
