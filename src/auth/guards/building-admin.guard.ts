import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';

@Injectable()
export class BuildingAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Platform admins have access to all admin operations
    if (user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    // Check if user is a building admin
    if (user.role !== 'BUILDING_ADMIN') {
      throw new ForbiddenException(
        'You must be a Building Admin to perform this action',
      );
    }

    // Get buildingId from request params or body
    const buildingId = request.params.buildingId || request.body?.buildingId;

    if (!buildingId) {
      throw new ForbiddenException('Building ID is required');
    }

    // Verify user is admin of this specific building
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });

    if (!building) {
      throw new ForbiddenException('Building not found');
    }

    if (building.adminId !== user.id) {
      throw new ForbiddenException(
        'You are not the admin of this building',
      );
    }

    // Attach building admin context to request
    request.buildingContext = {
      buildingId,
      isAdmin: true,
      isResident: false,
    };

    return true;
  }
}
