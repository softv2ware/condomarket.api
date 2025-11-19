import { Report, ReportType, ReportReason, ReportStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class ReportEntity implements Partial<Report> {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reporterId: string;

  @ApiProperty({ enum: ReportType })
  reportType: ReportType;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty({ enum: ReportReason })
  reason: ReportReason;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ enum: ReportStatus })
  status: ReportStatus;

  @ApiProperty({ required: false })
  reviewedBy?: string;

  @ApiProperty({ required: false })
  reviewedAt?: Date;

  @ApiProperty({ required: false })
  resolution?: string;

  @ApiProperty({ required: false })
  buildingId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<Report>) {
    Object.assign(this, partial);
  }
}
