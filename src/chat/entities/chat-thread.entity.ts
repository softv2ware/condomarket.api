import { ApiProperty } from '@nestjs/swagger';
import { MessageEntity } from './message.entity';

export class ChatThreadEntity {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  orderId?: string;

  @ApiProperty({ required: false })
  bookingId?: string;

  @ApiProperty({ type: [String] })
  participantIds: string[];

  @ApiProperty({ required: false })
  lastMessageAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [MessageEntity], required: false })
  messages?: MessageEntity[];

  @ApiProperty({ required: false })
  unreadCount?: number;
}
