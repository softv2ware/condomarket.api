import { Test, TestingModule } from '@nestjs/testing';
import { BuildingSettingsService } from './building-settings.service';
import { PrismaService } from '~/prisma';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('BuildingSettingsService', () => {
  let service: BuildingSettingsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    building: {
      findUnique: jest.fn(),
    },
    buildingSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    report: {
      count: jest.fn(),
    },
    moderationAction: {
      count: jest.fn(),
    },
    listing: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildingSettingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BuildingSettingsService>(BuildingSettingsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      const buildingId = 'building-123';
      const mockBuilding = { id: buildingId };
      const mockSettings = {
        id: 'settings-123',
        buildingId,
        requireListingApproval: false,
        allowedCategories: [],
        maxListingsPerSeller: 10,
        autoModeration: true,
        autoHideThreshold: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.buildingSettings.findUnique.mockResolvedValue(
        mockSettings,
      );

      const result = await service.getSettings(buildingId);

      expect(result).toBeDefined();
      expect(result.buildingId).toBe(buildingId);
      expect(result.autoHideThreshold).toBe(3);
    });

    it('should create default settings if not exists', async () => {
      const buildingId = 'building-123';
      const mockBuilding = { id: buildingId };
      const mockSettings = {
        id: 'settings-123',
        buildingId,
        requireListingApproval: false,
        allowedCategories: [],
        maxListingsPerSeller: 10,
        autoModeration: true,
        autoHideThreshold: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.buildingSettings.findUnique.mockResolvedValue(null);
      mockPrismaService.buildingSettings.create.mockResolvedValue(mockSettings);

      const result = await service.getSettings(buildingId);

      expect(result).toBeDefined();
      expect(mockPrismaService.buildingSettings.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent building', async () => {
      mockPrismaService.building.findUnique.mockResolvedValue(null);

      await expect(service.getSettings('building-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSettings', () => {
    const updateDto = {
      requireListingApproval: true,
      autoHideThreshold: 5,
    };

    it('should update settings for platform admin', async () => {
      const buildingId = 'building-123';
      const userId = 'admin-123';
      const mockBuilding = { id: buildingId };
      const mockUser = {
        id: userId,
        role: 'PLATFORM_ADMIN',
        managedBuildings: [],
      };
      const mockSettings = {
        id: 'settings-123',
        buildingId,
        ...updateDto,
      };

      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.buildingSettings.findUnique.mockResolvedValue(
        mockSettings,
      );
      mockPrismaService.buildingSettings.update.mockResolvedValue(mockSettings);

      const result = await service.updateSettings(
        buildingId,
        userId,
        updateDto,
      );

      expect(result).toBeDefined();
      expect(result.requireListingApproval).toBe(true);
      expect(mockPrismaService.buildingSettings.update).toHaveBeenCalled();
    });

    it('should update settings for building admin of that building', async () => {
      const buildingId = 'building-123';
      const userId = 'admin-123';
      const mockBuilding = { id: buildingId };
      const mockUser = {
        id: userId,
        role: 'BUILDING_ADMIN',
        managedBuildings: [{ id: buildingId }],
      };
      const mockSettings = {
        id: 'settings-123',
        buildingId,
        ...updateDto,
      };

      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.buildingSettings.findUnique.mockResolvedValue(
        mockSettings,
      );
      mockPrismaService.buildingSettings.update.mockResolvedValue(mockSettings);

      const result = await service.updateSettings(
        buildingId,
        userId,
        updateDto,
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.buildingSettings.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      const buildingId = 'building-123';
      const userId = 'user-123';
      const mockBuilding = { id: buildingId };
      const mockUser = {
        id: userId,
        role: 'RESIDENT',
        managedBuildings: [],
      };

      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.updateSettings(buildingId, userId, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for building admin of different building', async () => {
      const buildingId = 'building-123';
      const userId = 'admin-123';
      const mockBuilding = { id: buildingId };
      const mockUser = {
        id: userId,
        role: 'BUILDING_ADMIN',
        managedBuildings: [{ id: 'building-456' }],
      };

      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.updateSettings(buildingId, userId, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getModerationStats', () => {
    it('should return moderation statistics', async () => {
      const buildingId = 'building-123';
      const mockBuilding = { id: buildingId };

      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.report.count
        .mockResolvedValueOnce(50) // total reports
        .mockResolvedValueOnce(10) // pending reports
        .mockResolvedValueOnce(35); // resolved reports
      mockPrismaService.moderationAction.count
        .mockResolvedValueOnce(20) // total actions
        .mockResolvedValueOnce(5); // active restrictions
      mockPrismaService.listing.count.mockResolvedValue(3); // flagged listings

      const result = await service.getModerationStats(buildingId);

      expect(result).toBeDefined();
      expect(result.totalReports).toBe(50);
      expect(result.pendingReports).toBe(10);
      expect(result.resolvedReports).toBe(35);
      expect(result.totalModerationActions).toBe(20);
      expect(result.activeRestrictions).toBe(5);
      expect(result.flaggedContent).toBe(3);
    });

    it('should throw NotFoundException for non-existent building', async () => {
      mockPrismaService.building.findUnique.mockResolvedValue(null);

      await expect(service.getModerationStats('building-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
