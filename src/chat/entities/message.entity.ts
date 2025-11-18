import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';

export class MessageEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  threadId: string;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: MessageType })
  type: MessageType;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ type: [String] })
  readBy: string[];

  @ApiProperty()
  sentAt: Date;

  @ApiProperty({ required: false })
  editedAt?: Date;

  @ApiProperty({ required: false })
  deletedAt?: Date;
}
