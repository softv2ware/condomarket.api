import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { NotFoundException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getUserBuildings: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'RESIDENT',
    status: 'VERIFIED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [mockUser];
      mockUsersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(result).toEqual(users);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users exist', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user details', async () => {
      const userWithDetails = {
        ...mockUser,
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
        },
        residences: [],
      };

      mockUsersService.findOne.mockResolvedValue(userWithDetails);

      const result = await controller.getCurrentUser(mockRequest);

      expect(result).toEqual(userWithDetails);
      expect(service.findOne).toHaveBeenCalledWith('user-1');
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMyProfile', () => {
    it('should return current user profile', async () => {
      const mockProfile = {
        id: 'profile-1',
        userId: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Test bio',
        acceptedPaymentMethods: ['Venmo', 'PayPal'],
      };

      mockUsersService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile(mockRequest);

      expect(result).toEqual(mockProfile);
      expect(service.getProfile).toHaveBeenCalledWith('user-1');
      expect(service.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when profile not found', async () => {
      mockUsersService.getProfile.mockRejectedValue(
        new NotFoundException('Profile not found'),
      );

      await expect(controller.getMyProfile(mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMyProfile', () => {
    it('should update current user profile', async () => {
      const updateProfileDto: UpdateProfileDto = {
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Updated bio',
        acceptedPaymentMethods: ['Venmo', 'Cash'],
      };

      const updatedProfile = {
        id: 'profile-1',
        userId: 'user-1',
        ...updateProfileDto,
      };

      mockUsersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMyProfile(mockRequest, updateProfileDto);

      expect(result).toEqual(updatedProfile);
      expect(service.updateProfile).toHaveBeenCalledWith('user-1', updateProfileDto);
      expect(service.updateProfile).toHaveBeenCalledTimes(1);
    });

    it('should allow partial profile updates', async () => {
      const updateProfileDto: UpdateProfileDto = {
        bio: 'New bio only',
      };

      const updatedProfile = {
        id: 'profile-1',
        userId: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        bio: 'New bio only',
      };

      mockUsersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMyProfile(mockRequest, updateProfileDto);

      expect(result).toEqual(updatedProfile);
      expect(service.updateProfile).toHaveBeenCalledWith('user-1', updateProfileDto);
    });
  });

  describe('getMyBuildings', () => {
    it('should return current user buildings', async () => {
      const mockBuildings = [
        {
          id: 'residency-1',
          userId: 'user-1',
          buildingId: 'building-1',
          building: {
            id: 'building-1',
            name: 'Test Building',
            address: '123 Test St',
          },
          unit: {
            id: 'unit-1',
            unitNumber: '101',
          },
          verificationStatus: 'APPROVED',
        },
      ];

      mockUsersService.getUserBuildings.mockResolvedValue(mockBuildings);

      const result = await controller.getMyBuildings(mockRequest);

      expect(result).toEqual(mockBuildings);
      expect(service.getUserBuildings).toHaveBeenCalledWith('user-1');
      expect(service.getUserBuildings).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user has no buildings', async () => {
      mockUsersService.getUserBuildings.mockResolvedValue([]);

      const result = await controller.getMyBuildings(mockRequest);

      expect(result).toEqual([]);
      expect(service.getUserBuildings).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-1');

      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith('user-1');
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a user (admin only)', async () => {
      const updateUserDto: UpdateUserDto = {};

      const updatedUser = { ...mockUser, status: 'SUSPENDED' };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-1', updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(service.update).toHaveBeenCalledWith('user-1', updateUserDto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      const updateUserDto: UpdateUserDto = {};

      mockUsersService.update.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.update('non-existent', updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a user (admin only)', async () => {
      const mockResponse = { message: 'User successfully deleted' };
      mockUsersService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove('user-1');

      expect(result).toEqual(mockResponse);
      expect(service.remove).toHaveBeenCalledWith('user-1');
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when deleting non-existent user', async () => {
      mockUsersService.remove.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
