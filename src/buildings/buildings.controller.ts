import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Buildings')
@Controller('buildings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Post()
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Create a new building (Platform Admin only)' })
  @ApiResponse({ status: 201, description: 'Building created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createBuildingDto: CreateBuildingDto) {
    return this.buildingsService.create(createBuildingDto);
  }

  @Get()
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Get all buildings (Platform Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all buildings' })
  findAll() {
    return this.buildingsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get building by ID' })
  @ApiResponse({ status: 200, description: 'Building details' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  findOne(@Param('id') id: string) {
    return this.buildingsService.findOne(id);
  }

  @Patch(':id')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Update building' })
  @ApiResponse({ status: 200, description: 'Building updated successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  update(
    @Param('id') id: string,
    @Body() updateBuildingDto: UpdateBuildingDto,
  ) {
    return this.buildingsService.update(id, updateBuildingDto);
  }

  @Delete(':id')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Archive building (soft delete)' })
  @ApiResponse({ status: 200, description: 'Building archived successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  remove(@Param('id') id: string) {
    return this.buildingsService.remove(id);
  }

  // Unit management endpoints
  @Post(':id/units')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Add unit to building' })
  @ApiResponse({ status: 201, description: 'Unit created successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  createUnit(
    @Param('id') buildingId: string,
    @Body() createUnitDto: CreateUnitDto,
  ) {
    return this.buildingsService.createUnit(buildingId, createUnitDto);
  }

  @Get(':id/units')
  @ApiOperation({ summary: 'Get all units in a building' })
  @ApiResponse({ status: 200, description: 'List of units' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  getUnits(@Param('id') buildingId: string) {
    return this.buildingsService.getUnits(buildingId);
  }

  @Get(':buildingId/units/:unitId')
  @ApiOperation({ summary: 'Get unit details' })
  @ApiResponse({ status: 200, description: 'Unit details' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  getUnit(
    @Param('buildingId') buildingId: string,
    @Param('unitId') unitId: string,
  ) {
    return this.buildingsService.getUnit(buildingId, unitId);
  }
}
