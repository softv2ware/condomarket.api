import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto';

// Omit buildingId from updates - listings can't change buildings
export class UpdateListingDto extends PartialType(
  OmitType(CreateListingDto, ['buildingId'] as const),
) {}
