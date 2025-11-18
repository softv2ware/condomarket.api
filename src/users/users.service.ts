import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '~/prisma';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        profile: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        residences: {
          include: {
            building: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                state: true,
              },
            },
            unit: {
              select: {
                id: true,
                unitNumber: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Exclude password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      include: {
        profile: true,
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Upsert profile (create if doesn't exist, update if exists)
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...updateProfileDto,
      },
      update: updateProfileDto,
    });

    return profile;
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Profile for user ${userId} not found`);
    }

    return profile;
  }

  async getUserBuildings(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const residencies = await this.prisma.residentBuilding.findMany({
      where: { userId },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            type: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floor: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return residencies;
  }

  async getUserByBuildingId(userId: string, buildingId: string) {
    const residency = await this.prisma.residentBuilding.findFirst({
      where: {
        userId,
        buildingId,
      },
      include: {
        building: true,
        unit: true,
      },
    });

    if (!residency) {
      throw new NotFoundException(
        `User ${userId} is not a resident of building ${buildingId}`,
      );
    }

    return residency;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User successfully deleted' };
  }
}
