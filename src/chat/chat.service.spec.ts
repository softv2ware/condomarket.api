import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '~/prisma';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MessageType } from '@prisma/client';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: PrismaService;

  const mockPrismaService = {
    chatThread: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getThreads', () => {
    it('should return paginated threads for a user', async () => {
      const userId = 'user-1';
      const mockThreads = [
        {
          id: 'thread-1',
          orderId: 'order-1',
          bookingId: null,
          participantIds: ['user-1', 'user-2'],
          lastMessageAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          order: {
            listing: { title: 'Test Product', photos: [] },
            buyer: {
              id: 'user-1',
              profile: { firstName: 'John', lastName: 'Doe' },
            },
            seller: {
              id: 'user-2',
              profile: { firstName: 'Jane', lastName: 'Smith' },
            },
          },
          booking: null,
          messages: [{ id: 'msg-1', content: 'Hello', sentAt: new Date() }],
        },
      ];

      mockPrismaService.chatThread.findMany.mockResolvedValue(mockThreads);
      mockPrismaService.chatThread.count.mockResolvedValue(1);
      mockPrismaService.message.count.mockResolvedValue(2);

      const result = await service.getThreads(userId, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].unreadCount).toBe(2);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockPrismaService.chatThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { participantIds: { has: userId } },
        }),
      );
    });

    it('should handle empty thread list', async () => {
      mockPrismaService.chatThread.findMany.mockResolvedValue([]);
      mockPrismaService.chatThread.count.mockResolvedValue(0);

      const result = await service.getThreads('user-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getThreadById', () => {
    const threadId = 'thread-1';
    const userId = 'user-1';

    it('should return thread with messages for a participant', async () => {
      const mockThread = {
        id: threadId,
        participantIds: ['user-1', 'user-2'],
        orderId: 'order-1',
        bookingId: null,
        order: {
          listing: { title: 'Test', photos: [] },
          buyer: {
            id: 'user-1',
            profile: {
              firstName: 'John',
              lastName: 'Doe',
              profilePictureUrl: null,
            },
          },
          seller: {
            id: 'user-2',
            profile: {
              firstName: 'Jane',
              lastName: 'Smith',
              profilePictureUrl: null,
            },
          },
        },
        booking: null,
      };

      const mockMessages = [
        {
          id: 'msg-1',
          content: 'Hello',
          sentAt: new Date('2024-01-01'),
          sender: {
            id: 'user-2',
            profile: {
              firstName: 'Jane',
              lastName: 'Smith',
              profilePictureUrl: null,
            },
          },
        },
      ];

      mockPrismaService.chatThread.findUnique.mockResolvedValue(mockThread);
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

      const result = await service.getThreadById(threadId, userId, {
        page: 1,
        limit: 50,
      });

      expect(result.id).toBe(threadId);
      expect(result.messages).toHaveLength(1);
      expect(mockPrismaService.chatThread.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: threadId } }),
      );
    });

    it('should throw NotFoundException when thread does not exist', async () => {
      mockPrismaService.chatThread.findUnique.mockResolvedValue(null);

      await expect(
        service.getThreadById(threadId, userId, { page: 1, limit: 50 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const mockThread = {
        id: threadId,
        participantIds: ['user-2', 'user-3'],
      };

      mockPrismaService.chatThread.findUnique.mockResolvedValue(mockThread);

      await expect(
        service.getThreadById(threadId, userId, { page: 1, limit: 50 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should support cursor-based pagination with "before" parameter', async () => {
      const mockThread = {
        id: threadId,
        participantIds: ['user-1', 'user-2'],
        order: null,
        booking: null,
      };

      const beforeMessageId = 'msg-10';
      const beforeMessage = { sentAt: new Date('2024-01-01T12:00:00Z') };

      mockPrismaService.chatThread.findUnique.mockResolvedValue(mockThread);
      mockPrismaService.message.findUnique.mockResolvedValue(beforeMessage);
      mockPrismaService.message.findMany.mockResolvedValue([]);

      await service.getThreadById(threadId, userId, {
        page: 1,
        limit: 50,
        before: beforeMessageId,
      });

      expect(mockPrismaService.message.findUnique).toHaveBeenCalledWith({
        where: { id: beforeMessageId },
        select: { sentAt: true },
      });
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sentAt: { lt: beforeMessage.sentAt },
          }),
        }),
      );
    });
  });

  describe('sendMessage', () => {
    const threadId = 'thread-1';
    const userId = 'user-1';

    it('should send a message successfully', async () => {
      const mockThread = {
        id: threadId,
        participantIds: ['user-1', 'user-2'],
      };

      const mockMessage = {
        id: 'msg-1',
        content: 'Hello',
        senderId: userId,
        sentAt: new Date(),
        sender: {
          id: userId,
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            profilePictureUrl: null,
          },
        },
      };

      mockPrismaService.chatThread.findUnique.mockResolvedValue(mockThread);
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.chatThread.update.mockResolvedValue(mockThread);

      const result = await service.sendMessage(threadId, userId, {
        content: 'Hello',
        type: MessageType.TEXT,
      });

      expect(result.content).toBe('Hello');
      expect(mockPrismaService.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Hello',
            senderId: userId,
            type: MessageType.TEXT,
            readBy: [userId],
          }),
        }),
      );
      expect(mockPrismaService.chatThread.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: threadId },
          data: { lastMessageAt: mockMessage.sentAt },
        }),
      );
    });

    it('should throw NotFoundException when thread does not exist', async () => {
      mockPrismaService.chatThread.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage(threadId, userId, { content: 'Hello' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const mockThread = {
        id: threadId,
        participantIds: ['user-2', 'user-3'],
      };

      mockPrismaService.chatThread.findUnique.mockResolvedValue(mockThread);

      await expect(
        service.sendMessage(threadId, userId, { content: 'Hello' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('editMessage', () => {
    const messageId = 'msg-1';
    const userId = 'user-1';

    it('should edit a message within 15 minutes', async () => {
      const recentDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const mockMessage = {
        id: messageId,
        senderId: userId,
        content: 'Original',
        sentAt: recentDate,
        deletedAt: null,
        thread: { id: 'thread-1' },
      };

      const updatedMessage = {
        ...mockMessage,
        content: 'Updated',
        editedAt: new Date(),
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.message.update.mockResolvedValue(updatedMessage);

      const result = await service.editMessage(messageId, userId, {
        content: 'Updated',
      });

      expect(result.content).toBe('Updated');
      expect(mockPrismaService.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: messageId },
          data: expect.objectContaining({
            content: 'Updated',
            editedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException when message does not exist', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.editMessage(messageId, userId, { content: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the sender', async () => {
      const mockMessage = {
        id: messageId,
        senderId: 'user-2',
        sentAt: new Date(),
        deletedAt: null,
        thread: { id: 'thread-1' },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(
        service.editMessage(messageId, userId, { content: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when message is deleted', async () => {
      const mockMessage = {
        id: messageId,
        senderId: userId,
        sentAt: new Date(),
        deletedAt: new Date(),
        thread: { id: 'thread-1' },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(
        service.editMessage(messageId, userId, { content: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when edit window expired (>15 minutes)', async () => {
      const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      const mockMessage = {
        id: messageId,
        senderId: userId,
        sentAt: oldDate,
        deletedAt: null,
        thread: { id: 'thread-1' },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(
        service.editMessage(messageId, userId, { content: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.message.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    const messageId = 'msg-1';
    const userId = 'user-1';

    it('should soft delete a message', async () => {
      const mockMessage = {
        id: messageId,
        senderId: userId,
        deletedAt: null,
        thread: { id: 'thread-1' },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        deletedAt: new Date(),
        content: '[Message deleted]',
      });

      const result = await service.deleteMessage(messageId, userId);

      expect(result.deletedAt).toBeDefined();
      expect(result.content).toBe('[Message deleted]');
      expect(mockPrismaService.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: messageId },
          data: {
            deletedAt: expect.any(Date),
            content: '[Message deleted]',
          },
        }),
      );
    });

    it('should throw ForbiddenException when user is not the sender', async () => {
      const mockMessage = {
        id: messageId,
        senderId: 'user-2',
        deletedAt: null,
        thread: { id: 'thread-1' },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(service.deleteMessage(messageId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when message already deleted', async () => {
      const mockMessage = {
        id: messageId,
        senderId: userId,
        deletedAt: new Date(),
        thread: { id: 'thread-1' },
      };

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(service.deleteMessage(messageId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('markAsRead', () => {
    const threadId = 'thread-1';
    const userId = 'user-1';

    it('should mark all unread messages as read', async () => {
      const mockThread = {
        id: threadId,
        participantIds: ['user-1', 'user-2'],
      };

      const mockUnreadMessages = [
        { id: 'msg-1', readBy: ['user-2'] },
        { id: 'msg-2', readBy: ['user-2'] },
      ];

      mockPrismaService.chatThread.findUnique.mockResolvedValue(mockThread);
      mockPrismaService.message.findMany.mockResolvedValue(mockUnreadMessages);
      mockPrismaService.message.update.mockResolvedValue({});

      const result = await service.markAsRead(threadId, userId);

      expect(result.success).toBe(true);
      expect(result.markedRead).toBe(2);
      expect(mockPrismaService.message.update).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const mockThread = {
        id: threadId,
        participantIds: ['user-2', 'user-3'],
      };

      mockPrismaService.chatThread.findUnique.mockResolvedValue(mockThread);

      await expect(service.markAsRead(threadId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return total unread message count', async () => {
      mockPrismaService.message.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result.unreadCount).toBe(5);
      expect(mockPrismaService.message.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            thread: { participantIds: { has: 'user-1' } },
            senderId: { not: 'user-1' },
          }),
        }),
      );
    });
  });

  describe('createThread', () => {
    it('should create a new thread for an order', async () => {
      const mockThread = {
        id: 'thread-1',
        orderId: 'order-1',
        bookingId: null,
        participantIds: ['user-1', 'user-2'],
      };

      mockPrismaService.chatThread.findFirst.mockResolvedValue(null);
      mockPrismaService.chatThread.create.mockResolvedValue(mockThread);

      const result = await service.createThread({
        orderId: 'order-1',
        participantIds: ['user-1', 'user-2'],
      });

      expect(result.orderId).toBe('order-1');
      expect(mockPrismaService.chatThread.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          bookingId: undefined,
          participantIds: ['user-1', 'user-2'],
        },
      });
    });

    it('should return existing thread if already exists', async () => {
      const existingThread = {
        id: 'thread-1',
        bookingId: 'booking-1',
        participantIds: ['user-1', 'user-2'],
      };

      mockPrismaService.chatThread.findFirst.mockResolvedValue(existingThread);

      const result = await service.createThread({
        bookingId: 'booking-1',
        participantIds: ['user-1', 'user-2'],
      });

      expect(result).toBe(existingThread);
      expect(mockPrismaService.chatThread.create).not.toHaveBeenCalled();
    });
  });
});
