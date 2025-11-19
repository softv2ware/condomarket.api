import { Test, TestingModule } from '@nestjs/testing';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { VerifyWithInvitationCodeDto } from './dto/verify-with-code.dto';
import { VerifyWithUnitDto } from './dto/verify-with-unit.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { GenerateInvitationCodeDto } from './dto/generate-invitation.dto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('VerificationController', () => {
  let controller: VerificationController;
  let service: VerificationService;

  const mockVerificationService = {
    verifyWithInvitationCode: jest.fn(),
    verifyWithUnit: jest.fn(),
    requestVerification: jest.fn(),
    reviewVerification: jest.fn(),
    generateInvitationCode: jest.fn(),
    getPendingVerifications: jest.fn(),
    getBuildingVerifications: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'RESIDENT',
  };

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'BUILDING_ADMIN',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: mockVerificationService,
        },
      ],
    }).compile();

    controller = module.get<VerificationController>(VerificationController);
    service = module.get<VerificationService>(VerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifyWithCode', () => {
    it('should verify user with valid invitation code', async () => {
      const dto: VerifyWithInvitationCodeDto = {
        code: 'SUNSET2024ABC',
      };

      const mockResponse = {
        id: 'residency-1',
        userId: 'user-1',
        buildingId: 'building-1',
        verificationStatus: 'APPROVED',
        verificationMethod: 'INVITATION_CODE',
      };

      mockVerificationService.verifyWithInvitationCode.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.verifyWithCode(mockUser, dto);

      expect(result).toEqual(mockResponse);
      expect(service.verifyWithInvitationCode).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(service.verifyWithInvitationCode).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for invalid code', async () => {
      const dto: VerifyWithInvitationCodeDto = {
        code: 'INVALID_CODE',
      };

      mockVerificationService.verifyWithInvitationCode.mockRejectedValue(
        new BadRequestException('Invalid or expired invitation code'),
      );

      await expect(controller.verifyWithCode(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired code', async () => {
      const dto: VerifyWithInvitationCodeDto = {
        code: 'EXPIRED_CODE',
      };

      mockVerificationService.verifyWithInvitationCode.mockRejectedValue(
        new BadRequestException('Invitation code has expired'),
      );

      await expect(controller.verifyWithCode(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyWithUnit', () => {
    it('should verify user with unit number and last name', async () => {
      const dto: VerifyWithUnitDto = {
        buildingId: 'building-1',
        unitNumber: '101',
        lastName: 'Doe',
      };

      const mockResponse = {
        id: 'residency-1',
        userId: 'user-1',
        buildingId: 'building-1',
        unitId: 'unit-1',
        verificationStatus: 'APPROVED',
        verificationMethod: 'UNIT_CODE_LASTNAME',
      };

      mockVerificationService.verifyWithUnit.mockResolvedValue(mockResponse);

      const result = await controller.verifyWithUnit(mockUser, dto);

      expect(result).toEqual(mockResponse);
      expect(service.verifyWithUnit).toHaveBeenCalledWith('user-1', dto);
      expect(service.verifyWithUnit).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for incorrect information', async () => {
      const dto: VerifyWithUnitDto = {
        buildingId: 'building-1',
        unitNumber: '101',
        lastName: 'WrongName',
      };

      mockVerificationService.verifyWithUnit.mockRejectedValue(
        new BadRequestException('Unit not found or last name does not match'),
      );

      await expect(controller.verifyWithUnit(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('requestVerification', () => {
    it('should submit verification request', async () => {
      const dto: RequestVerificationDto = {
        buildingId: 'building-1',
        unitId: 'unit-1',
        notes: 'I am a new resident',
      };

      const mockResponse = {
        id: 'residency-1',
        userId: 'user-1',
        buildingId: 'building-1',
        unitId: 'unit-1',
        verificationStatus: 'PENDING',
        verificationMethod: 'MANUAL_APPROVAL',
        verificationData: { notes: dto.notes },
      };

      mockVerificationService.requestVerification.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.requestVerification(mockUser, dto);

      expect(result).toEqual(mockResponse);
      expect(service.requestVerification).toHaveBeenCalledWith('user-1', dto);
      expect(service.requestVerification).toHaveBeenCalledTimes(1);
    });
  });

  describe('reviewVerification', () => {
    it('should approve verification request', async () => {
      const verificationId = 'residency-1';
      const dto: ReviewVerificationDto = {
        approved: true,
        reason: 'Verified documents',
      };

      const mockResponse = {
        id: verificationId,
        userId: 'user-1',
        buildingId: 'building-1',
        verificationStatus: 'APPROVED',
        verifiedBy: 'admin-1',
        verifiedAt: new Date(),
      };

      mockVerificationService.reviewVerification.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.reviewVerification(
        verificationId,
        mockAdmin,
        dto,
      );

      expect(result).toEqual(mockResponse);
      expect(service.reviewVerification).toHaveBeenCalledWith(
        verificationId,
        'admin-1',
        dto,
      );
      expect(service.reviewVerification).toHaveBeenCalledTimes(1);
    });

    it('should reject verification request', async () => {
      const verificationId = 'residency-1';
      const dto: ReviewVerificationDto = {
        approved: false,
        reason: 'Insufficient documentation',
      };

      const mockResponse = {
        id: verificationId,
        userId: 'user-1',
        buildingId: 'building-1',
        verificationStatus: 'REJECTED',
        verifiedBy: 'admin-1',
        verifiedAt: new Date(),
      };

      mockVerificationService.reviewVerification.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.reviewVerification(
        verificationId,
        mockAdmin,
        dto,
      );

      expect(result).toEqual(mockResponse);
      expect(service.reviewVerification).toHaveBeenCalledWith(
        verificationId,
        'admin-1',
        dto,
      );
    });

    it('should throw ForbiddenException when non-admin tries to review', async () => {
      const verificationId = 'residency-1';
      const dto: ReviewVerificationDto = {
        approved: true,
      };

      mockVerificationService.reviewVerification.mockRejectedValue(
        new ForbiddenException('Only building admins can review verifications'),
      );

      await expect(
        controller.reviewVerification(verificationId, mockUser, dto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generateInvitationCode', () => {
    it('should generate invitation code for building admin', async () => {
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const dto: GenerateInvitationCodeDto = {
        buildingId: 'building-1',
        expiresAt,
      };

      const mockResponse = {
        id: 'invitation-1',
        code: 'SUNSET2024ABC',
        buildingId: 'building-1',
        createdBy: 'admin-1',
        expiresAt: new Date(expiresAt),
        isActive: true,
      };

      mockVerificationService.generateInvitationCode.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.generateInvitationCode(mockAdmin, dto);

      expect(result).toEqual(mockResponse);
      expect(service.generateInvitationCode).toHaveBeenCalledWith(
        'admin-1',
        dto,
      );
      expect(service.generateInvitationCode).toHaveBeenCalledTimes(1);
    });

    it('should throw ForbiddenException when non-admin tries to generate code', async () => {
      const dto: GenerateInvitationCodeDto = {
        buildingId: 'building-1',
      };

      mockVerificationService.generateInvitationCode.mockRejectedValue(
        new ForbiddenException(
          'Only building admins can generate invitation codes',
        ),
      );

      await expect(
        controller.generateInvitationCode(mockUser, dto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPendingVerifications', () => {
    it('should return pending verifications for a building', async () => {
      const buildingId = 'building-1';
      const mockPendingVerifications = [
        {
          id: 'residency-1',
          userId: 'user-1',
          buildingId: 'building-1',
          verificationStatus: 'PENDING',
          user: {
            email: 'user1@example.com',
            profile: {
              firstName: 'John',
              lastName: 'Doe',
            },
          },
        },
        {
          id: 'residency-2',
          userId: 'user-2',
          buildingId: 'building-1',
          verificationStatus: 'PENDING',
          user: {
            email: 'user2@example.com',
            profile: {
              firstName: 'Jane',
              lastName: 'Smith',
            },
          },
        },
      ];

      mockVerificationService.getPendingVerifications.mockResolvedValue(
        mockPendingVerifications,
      );

      const result = await controller.getPendingVerifications(buildingId);

      expect(result).toEqual(mockPendingVerifications);
      expect(service.getPendingVerifications).toHaveBeenCalledWith(buildingId);
      expect(service.getPendingVerifications).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no pending verifications', async () => {
      const buildingId = 'building-1';
      mockVerificationService.getPendingVerifications.mockResolvedValue([]);

      const result = await controller.getPendingVerifications(buildingId);

      expect(result).toEqual([]);
      expect(service.getPendingVerifications).toHaveBeenCalledWith(buildingId);
    });
  });
});
