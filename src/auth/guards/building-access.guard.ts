import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '~/prisma';

@Injectable()
export class BuildingAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Platform admins have access to all buildings
    if (user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    // Get buildingId from request params or body
    const buildingId = request.params.buildingId || request.body?.buildingId;

    if (!buildingId) {
      throw new ForbiddenException('Building ID is required');
    }

    // Check if user is building admin
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });

    if (building && building.adminId === user.id) {
      return true;
    }

    // Check if user is a resident of the building
    const residency = await this.prisma.residentBuilding.findFirst({
      where: {
        userId: user.id,
        buildingId: buildingId,
        verificationStatus: 'APPROVED',
      },
    });

    if (!residency) {
      throw new ForbiddenException(
        'You do not have access to this building',
      );
    }

    // Attach building context to request for later use
    request.buildingContext = {
      buildingId,
      isAdmin: false,
      isResident: true,
    };

    return true;
  }
}
