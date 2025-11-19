export class UpdateBuildingSettingsDto {
  requireListingApproval?: boolean;
  allowedCategories?: string[];
  maxListingsPerSeller?: number;
  autoModeration?: boolean;
  autoHideThreshold?: number;
}
