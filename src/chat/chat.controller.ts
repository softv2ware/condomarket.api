import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { GetThreadsDto } from './dto/get-threads.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { ChatThreadEntity } from './entities/chat-thread.entity';
import { MessageEntity } from './entities/message.entity';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Get all chat threads for current user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Chat threads retrieved', type: [ChatThreadEntity] })
  async getThreads(
    @CurrentUser('id') userId: string,
    @Query() query: GetThreadsDto,
  ) {
    return this.chatService.getThreads(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread message count' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Unread count retrieved' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.chatService.getUnreadCount(userId);
  }

  @Get(':threadId')
  @ApiOperation({ summary: 'Get a chat thread with messages' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Chat thread retrieved', type: ChatThreadEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not a participant' })
  async getThreadById(
    @Param('threadId') threadId: string,
    @CurrentUser('id') userId: string,
    @Query() query: GetMessagesDto,
  ) {
    return this.chatService.getThreadById(threadId, userId, query);
  }

  @Post(':threadId/messages')
  @ApiOperation({ summary: 'Send a message in a chat thread' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Message sent', type: MessageEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not a participant' })
  async sendMessage(
    @Param('threadId') threadId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(threadId, userId, dto);
  }

  @Patch(':threadId/messages/:messageId')
  @ApiOperation({ summary: 'Edit a message (within 15 minutes)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Message edited', type: MessageEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Message not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the message sender' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Edit window expired or message deleted' })
  async editMessage(
    @Param('messageId') messageId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(messageId, userId, dto);
  }

  @Delete(':threadId/messages/:messageId')
  @ApiOperation({ summary: 'Soft delete a message' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Message deleted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Message not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the message sender' })
  async deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.deleteMessage(messageId, userId);
  }

  @Patch(':threadId/read')
  @ApiOperation({ summary: 'Mark all messages in thread as read' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Thread marked as read' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not a participant' })
  async markAsRead(
    @Param('threadId') threadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.markAsRead(threadId, userId);
  }
}
