import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { Message } from '@prisma/client';
import { ChatService } from './chat.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { WsUser } from './decorators/ws-user.decorator';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake auth or query
      const token =
        (client.handshake.auth?.token as string | undefined) || 
        (client.handshake.query?.token as string | undefined);

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Note: Token validation will be handled by WsJwtGuard on each message
      // For now, just log the connection
      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Join a chat thread room
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_thread')
  async handleJoinThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { threadId: string },
    @WsUser() userId: string,
  ) {
    try {
      const { threadId } = data;

      // Verify user is a participant of the thread by trying to get it
      const thread = await this.chatService.getThreadById(threadId, userId, {
        page: 1,
        limit: 1,
      });

      if (!thread) {
        client.emit('error', {
          event: 'join_thread',
          message: 'Thread not found or access denied',
        });
        return;
      }

      // Join the Socket.IO room for this thread
      await client.join(`thread:${threadId}`);

      this.logger.log(`User ${userId} joined thread ${threadId}`);

      client.emit('joined_thread', {
        threadId,
        message: 'Successfully joined thread',
      });
    } catch (error) {
      this.logger.error(
        `Error joining thread: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.emit('error', {
        event: 'join_thread',
        message: 'Failed to join thread',
      });
    }
  }

  /**
   * Leave a chat thread room
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_thread')
  async handleLeaveThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { threadId: string },
    @WsUser() userId: string,
  ) {
    try {
      const { threadId } = data;

      await client.leave(`thread:${threadId}`);

      this.logger.log(`User ${userId} left thread ${threadId}`);

      client.emit('left_thread', {
        threadId,
        message: 'Successfully left thread',
      });
    } catch (error) {
      this.logger.error(
        `Error leaving thread: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.emit('error', {
        event: 'leave_thread',
        message: 'Failed to leave thread',
      });
    }
  }

  /**
   * Send a message in a thread
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { threadId: string; content: string },
    @WsUser() userId: string,
  ) {
    try {
      const { threadId, content } = data;

      // Create the message using the chat service
      const message = await this.chatService.sendMessage(userId, threadId, {
        content,
      });

      // Broadcast the message to all users in the thread room
      this.server.to(`thread:${threadId}`).emit('message_sent', {
        message,
        threadId,
      });

      this.logger.log(`Message sent by user ${userId} in thread ${threadId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      this.logger.error(`Error sending message: ${errorMessage}`);
      client.emit('error', {
        event: 'send_message',
        message: errorMessage,
      });
    }
  }

  /**
   * Send typing indicator
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { threadId: string; isTyping: boolean },
    @WsUser() userId: string,
  ) {
    try {
      const { threadId, isTyping } = data;

      // Broadcast typing status to other users in the thread (exclude sender)
      client.to(`thread:${threadId}`).emit('user_typing', {
        threadId,
        userId,
        isTyping,
      });
    } catch (error) {
      this.logger.error(
        `Error handling typing indicator: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Mark messages as read
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { threadId: string },
    @WsUser() userId: string,
  ) {
    try {
      const { threadId } = data;

      await this.chatService.markAsRead(threadId, userId);

      client.emit('marked_read', {
        threadId,
        message: 'Messages marked as read',
      });

      // Notify other participants that messages were read
      client.to(`thread:${threadId}`).emit('messages_read', {
        threadId,
        userId,
      });
    } catch (error) {
      this.logger.error(
        `Error marking messages as read: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.emit('error', {
        event: 'mark_read',
        message: 'Failed to mark messages as read',
      });
    }
  }

  /**
   * Emit a message edited event to thread participants
   */
  emitMessageEdited(threadId: string, message: Message): void {
    this.server.to(`thread:${threadId}`).emit('message_edited', {
      message,
      threadId,
    });
  }

  /**
   * Emit a message deleted event to thread participants
   */
  emitMessageDeleted(threadId: string, messageId: string) {
    this.server.to(`thread:${threadId}`).emit('message_deleted', {
      messageId,
      threadId,
    });
  }
}
