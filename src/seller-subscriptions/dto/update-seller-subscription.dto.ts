import { PartialType } from '@nestjs/swagger';
import { CreateSellerSubscriptionDto } from './create-seller-subscription.dto';

export class UpdateSellerSubscriptionDto extends PartialType(CreateSellerSubscriptionDto) {}
