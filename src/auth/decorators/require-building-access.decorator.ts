import { SetMetadata } from '@nestjs/common';

export const REQUIRE_BUILDING_ACCESS_KEY = 'requireBuildingAccess';
export const RequireBuildingAccess = () =>
  SetMetadata(REQUIRE_BUILDING_ACCESS_KEY, true);
