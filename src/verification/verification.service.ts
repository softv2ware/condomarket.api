import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { VerifyWithInvitationCodeDto } from './dto/verify-with-code.dto';
import { VerifyWithUnitDto } from './dto/verify-with-unit.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { GenerateInvitationCodeDto } from './dto/generate-invitation.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class VerificationService {
  constructor(private prisma: PrismaService) {}

  // Method 1: Verify with invitation code
  async verifyWithInvitationCode(userId: string, dto: VerifyWithInvitationCodeDto) {
    const invitation = await this.prisma.invitationCode.findUnique({
      where: { code: dto.code },
      include: { building: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation code');
    }

    if (!invitation.isActive) {
      throw new BadRequestException('Invitation code has been deactivated');
    }

    if (invitation.usedBy) {
      throw new BadRequestException('Invitation code has already been used');
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      throw new BadRequestException('Invitation code has expired');
    }

    // Check if user is already a resident of this building
    const existingResidence = await this.prisma.residentBuilding.findUnique({
      where: {
        userId_buildingId: {
          userId,
          buildingId: invitation.buildingId,
        },
      },
    });

    if (existingResidence) {
      throw new ConflictException('You are already registered for this building');
    }

    // Create residence and mark invitation as used
    const residence = await this.prisma.residentBuilding.create({
      data: {
        userId,
        buildingId: invitation.buildingId,
        verificationMethod: 'INVITATION_CODE',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verificationData: {
          invitationCode: dto.code,
        },
      },
      include: {
        building: true,
        unit: true,
      },
    });

    // Mark invitation as used
    await this.prisma.invitationCode.update({
      where: { id: invitation.id },
      data: {
        usedBy: userId,
        usedAt: new Date(),
        isActive: false,
      },
    });

    // Update user status to VERIFIED
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'VERIFIED' },
    });

    return residence;
  }

  // Method 2: Verify with unit code + last name
  async verifyWithUnit(userId: string, dto: VerifyWithUnitDto) {
    const { buildingId, unitNumber, lastName } = dto;

    // Find the unit
    const unit = await this.prisma.unit.findFirst({
      where: {
        buildingId,
        unitNumber,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found in this building');
    }

    // Get user profile to check last name
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user?.profile?.lastName) {
      throw new BadRequestException('Please complete your profile with your last name first');
    }

    // Simple last name matching (case-insensitive)
    if (user.profile.lastName.toLowerCase() !== lastName.toLowerCase()) {
      throw new BadRequestException('Last name does not match our records');
    }

    // Check if user is already a resident
    const existingResidence = await this.prisma.residentBuilding.findUnique({
      where: {
        userId_buildingId: {
          userId,
          buildingId,
        },
      },
    });

    if (existingResidence) {
      throw new ConflictException('You are already registered for this building');
    }

    // Create residence with auto-approval
    const residence = await this.prisma.residentBuilding.create({
      data: {
        userId,
        buildingId,
        unitId: unit.id,
        verificationMethod: 'UNIT_CODE_LASTNAME',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verificationData: {
          unitNumber,
          lastName,
        },
      },
      include: {
        building: true,
        unit: true,
      },
    });

    // Update user status to VERIFIED
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'VERIFIED' },
    });

    return residence;
  }

  // Method 3: Request manual approval
  async requestVerification(userId: string, dto: RequestVerificationDto) {
    const { buildingId, unitId, notes } = dto;

    // Check if building exists
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Check if user is already a resident
    const existingResidence = await this.prisma.residentBuilding.findUnique({
      where: {
        userId_buildingId: {
          userId,
          buildingId,
        },
      },
    });

    if (existingResidence) {
      if (existingResidence.verificationStatus === 'PENDING') {
        throw new ConflictException('You already have a pending verification request for this building');
      }
      throw new ConflictException('You are already registered for this building');
    }

    // Create pending verification request
    const residence = await this.prisma.residentBuilding.create({
      data: {
        userId,
        buildingId,
        unitId,
        verificationMethod: 'MANUAL_APPROVAL',
        verificationStatus: 'PENDING',
        verificationData: {
          notes,
          requestedAt: new Date().toISOString(),
        },
      },
      include: {
        building: true,
        unit: true,
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
    });

    return residence;
  }

  // Building admin: Get pending verifications
  async getPendingVerifications(buildingId: string) {
    return this.prisma.residentBuilding.findMany({
      where: {
        buildingId,
        verificationStatus: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        unit: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // Building admin: Approve/reject verification
  async reviewVerification(
    verificationId: string,
    adminId: string,
    dto: ReviewVerificationDto,
  ) {
    const residence = await this.prisma.residentBuilding.findUnique({
      where: { id: verificationId },
      include: { building: true },
    });

    if (!residence) {
      throw new NotFoundException('Verification request not found');
    }

    if (residence.verificationStatus !== 'PENDING') {
      throw new BadRequestException('This verification request has already been reviewed');
    }

    // Update residence
    const updated = await this.prisma.residentBuilding.update({
      where: { id: verificationId },
      data: {
        verificationStatus: dto.approved ? 'APPROVED' : 'REJECTED',
        verifiedAt: dto.approved ? new Date() : null,
        verifiedBy: adminId,
        verificationData: {
          ...(residence.verificationData as object),
          reviewedAt: new Date().toISOString(),
          reason: dto.reason,
        },
      },
      include: {
        building: true,
        unit: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
    });

    // If approved, update user status to VERIFIED
    if (dto.approved) {
      await this.prisma.user.update({
        where: { id: residence.userId },
        data: { status: 'VERIFIED' },
      });
    }

    return updated;
  }

  // Building admin: Generate invitation codes
  async generateInvitationCode(adminId: string, dto: GenerateInvitationCodeDto) {
    const { buildingId, expiresAt } = dto;

    // Verify building exists
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    // Generate unique code
    const code = this.generateUniqueCode();

    const invitation = await this.prisma.invitationCode.create({
      data: {
        buildingId,
        code,
        createdBy: adminId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    return invitation;
  }

  // Get invitation codes for a building
  async getInvitationCodes(buildingId: string) {
    return this.prisma.invitationCode.findMany({
      where: { buildingId },
      include: {
        creator: {
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
        usedByUser: {
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private generateUniqueCode(): string {
    return randomBytes(6).toString('hex').toUpperCase();
  }
}
