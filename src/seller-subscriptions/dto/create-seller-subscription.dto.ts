import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSellerSubscriptionDto {
  @ApiProperty({
    description: 'UUID of the subscription plan to subscribe to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  subscriptionPlanId: string;

  @ApiProperty({
    description: 'UUID of the building (required if plan is building-specific)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  buildingId?: string;
}
