import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '~/auth/guards/jwt-auth.guard';
import { RolesGuard } from '~/auth/guards/roles.guard';
import { Roles } from '~/auth/decorators/roles.decorator';
import { CurrentUser } from '~/auth/decorators/current-user.decorator';
import { BuildingSettingsService } from './building-settings.service';
import { UpdateBuildingSettingsDto } from './dto/update-building-settings.dto';
import { BuildingSettingsEntity } from './entities/building-settings.entity';

@Controller('buildings/:buildingId/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BuildingSettingsController {
  constructor(private readonly buildingSettingsService: BuildingSettingsService) {}

  /**
   * Get building settings
   */
  @Get()
  async getSettings(
    @Param('buildingId') buildingId: string,
  ): Promise<BuildingSettingsEntity> {
    return this.buildingSettingsService.getSettings(buildingId);
  }

  /**
   * Update building settings (Admin only)
   */
  @Patch()
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  async updateSettings(
    @Param('buildingId') buildingId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBuildingSettingsDto,
  ): Promise<BuildingSettingsEntity> {
    return this.buildingSettingsService.updateSettings(buildingId, userId, dto);
  }

  /**
   * Get moderation statistics (Admin only)
   */
  @Get('moderation-stats')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  async getModerationStats(@Param('buildingId') buildingId: string) {
    return this.buildingSettingsService.getModerationStats(buildingId);
  }
}
