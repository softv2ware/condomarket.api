import { BuildingSettings } from '@prisma/client';

export class BuildingSettingsEntity {
  id: string;
  buildingId: string;
  requireListingApproval: boolean;
  allowedCategories: string[];
  maxListingsPerSeller: number;
  autoModeration: boolean;
  autoHideThreshold: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: BuildingSettings) {
    Object.assign(this, partial);
  }
}
