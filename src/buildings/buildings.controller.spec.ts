import { Test, TestingModule } from '@nestjs/testing';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { NotFoundException } from '@nestjs/common';

describe('BuildingsController', () => {
  let controller: BuildingsController;
  let service: BuildingsService;

  const mockBuildingsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createUnit: jest.fn(),
    getUnits: jest.fn(),
    getUnit: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'PLATFORM_ADMIN',
  };

  const mockBuilding = {
    id: 'building-1',
    name: 'Test Building',
    address: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'USA',
    type: 'APARTMENT_COMPLEX',
    status: 'ACTIVE',
    description: 'Test description',
    adminId: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BuildingsController],
      providers: [
        {
          provide: BuildingsService,
          useValue: mockBuildingsService,
        },
      ],
    }).compile();

    controller = module.get<BuildingsController>(BuildingsController);
    service = module.get<BuildingsService>(BuildingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new building', async () => {
      const createBuildingDto: CreateBuildingDto = {
        name: 'Test Building',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        type: 'APARTMENT_COMPLEX' as any,
      };

      mockBuildingsService.create.mockResolvedValue(mockBuilding);

      const result = await controller.create(createBuildingDto);

      expect(result).toEqual(mockBuilding);
      expect(service.create).toHaveBeenCalledWith(createBuildingDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return an array of buildings', async () => {
      const buildings = [mockBuilding];
      mockBuildingsService.findAll.mockResolvedValue(buildings);

      const result = await controller.findAll();

      expect(result).toEqual(buildings);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no buildings exist', async () => {
      mockBuildingsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a building by id', async () => {
      mockBuildingsService.findOne.mockResolvedValue(mockBuilding);

      const result = await controller.findOne('building-1');

      expect(result).toEqual(mockBuilding);
      expect(service.findOne).toHaveBeenCalledWith('building-1');
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when building not found', async () => {
      mockBuildingsService.findOne.mockRejectedValue(
        new NotFoundException('Building not found'),
      );

      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(service.findOne).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('update', () => {
    it('should update a building', async () => {
      const updateBuildingDto: UpdateBuildingDto = {
        name: 'Updated Building',
        description: 'Updated description',
      };

      const updatedBuilding = { ...mockBuilding, ...updateBuildingDto };
      mockBuildingsService.update.mockResolvedValue(updatedBuilding);

      const result = await controller.update('building-1', updateBuildingDto);

      expect(result).toEqual(updatedBuilding);
      expect(service.update).toHaveBeenCalledWith('building-1', updateBuildingDto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when updating non-existent building', async () => {
      const updateBuildingDto: UpdateBuildingDto = {
        name: 'Updated Building',
      };

      mockBuildingsService.update.mockRejectedValue(
        new NotFoundException('Building not found'),
      );

      await expect(
        controller.update('non-existent', updateBuildingDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should archive a building', async () => {
      const archivedBuilding = { ...mockBuilding, status: 'ARCHIVED' };
      mockBuildingsService.remove.mockResolvedValue(archivedBuilding);

      const result = await controller.remove('building-1');

      expect(result).toEqual(archivedBuilding);
      expect(service.remove).toHaveBeenCalledWith('building-1');
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when archiving non-existent building', async () => {
      mockBuildingsService.remove.mockRejectedValue(
        new NotFoundException('Building not found'),
      );

      await expect(controller.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createUnit', () => {
    it('should create a unit in a building', async () => {
      const createUnitDto: CreateUnitDto = {
        unitNumber: '101',
        floor: 1,
        type: '2BR/1BA',
      };

      const mockUnit = {
        id: 'unit-1',
        buildingId: 'building-1',
        ...createUnitDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBuildingsService.createUnit.mockResolvedValue(mockUnit);

      const result = await controller.createUnit('building-1', createUnitDto);

      expect(result).toEqual(mockUnit);
      expect(service.createUnit).toHaveBeenCalledWith('building-1', createUnitDto);
      expect(service.createUnit).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when building not found', async () => {
      const createUnitDto: CreateUnitDto = {
        unitNumber: '101',
        floor: 1,
      };

      mockBuildingsService.createUnit.mockRejectedValue(
        new NotFoundException('Building not found'),
      );

      await expect(
        controller.createUnit('non-existent', createUnitDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnits', () => {
    it('should return all units for a building', async () => {
      const mockUnits = [
        {
          id: 'unit-1',
          buildingId: 'building-1',
          unitNumber: '101',
          floor: 1,
          type: '2BR/1BA',
        },
        {
          id: 'unit-2',
          buildingId: 'building-1',
          unitNumber: '102',
          floor: 1,
          type: '1BR/1BA',
        },
      ];

      mockBuildingsService.getUnits.mockResolvedValue(mockUnits);

      const result = await controller.getUnits('building-1');

      expect(result).toEqual(mockUnits);
      expect(service.getUnits).toHaveBeenCalledWith('building-1');
      expect(service.getUnits).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUnit', () => {
    it('should return a specific unit', async () => {
      const mockUnit = {
        id: 'unit-1',
        buildingId: 'building-1',
        unitNumber: '101',
        floor: 1,
        type: '2BR/1BA',
      };

      mockBuildingsService.getUnit.mockResolvedValue(mockUnit);

      const result = await controller.getUnit('building-1', 'unit-1');

      expect(result).toEqual(mockUnit);
      expect(service.getUnit).toHaveBeenCalledWith('building-1', 'unit-1');
      expect(service.getUnit).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when unit not found', async () => {
      mockBuildingsService.getUnit.mockRejectedValue(
        new NotFoundException('Unit not found'),
      );

      await expect(controller.getUnit('building-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
