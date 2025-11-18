import { IsEnum, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';

export class OverrideSubscriptionDto {
  @ApiProperty({
    description: 'New status for the subscription',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Reason for manual override',
    example: 'Customer service exception',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  reason: string;
}
