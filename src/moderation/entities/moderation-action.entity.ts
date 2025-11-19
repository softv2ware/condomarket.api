import { ModerationAction, ModerationType, ModerationStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class ModerationActionEntity implements Partial<ModerationAction> {
  @ApiProperty()
  id: string;

  @ApiProperty()
  targetType: string;

  @ApiProperty()
  targetId: string;

  @ApiProperty({ enum: ModerationType })
  actionType: ModerationType;

  @ApiProperty({ enum: ModerationStatus })
  status: ModerationStatus;

  @ApiProperty()
  performedBy: string;

  @ApiProperty()
  reason: string;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty({ required: false })
  revokedAt?: Date;

  @ApiProperty({ required: false })
  revokedBy?: string;

  @ApiProperty({ required: false })
  buildingId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<ModerationAction>) {
    Object.assign(this, partial);
  }
}
