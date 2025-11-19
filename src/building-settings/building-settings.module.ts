import { Module } from '@nestjs/common';
import { BuildingSettingsService } from './building-settings.service';
import { BuildingSettingsController } from './building-settings.controller';
import { PrismaService } from '~/prisma';

@Module({
  controllers: [BuildingSettingsController],
  providers: [BuildingSettingsService, PrismaService],
  exports: [BuildingSettingsService],
})
export class BuildingSettingsModule {}
