import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { GetThreadsDto } from './dto/get-threads.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { MessageType, Prisma } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all chat threads for a user with pagination
   */
  async getThreads(userId: string, dto: GetThreadsDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const [threads, total] = await Promise.all([
      this.prisma.chatThread.findMany({
        where: {
          participantIds: {
            has: userId,
          },
        },
        include: {
          order: {
            include: {
              listing: {
                select: { title: true, photos: { take: 1 } },
              },
              buyer: {
                select: {
                  id: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
              seller: {
                select: {
                  id: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          booking: {
            include: {
              listing: {
                select: { title: true, photos: { take: 1 } },
              },
              buyer: {
                select: {
                  id: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
              seller: {
                select: {
                  id: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            where: { deletedAt: null },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.chatThread.count({
        where: {
          participantIds: {
            has: userId,
          },
        },
      }),
    ]);

    // Add unread count for each thread
    const threadsWithUnread = await Promise.all(
      threads.map(async (thread) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            threadId: thread.id,
            senderId: { not: userId },
            NOT: {
              readBy: { has: userId },
            },
            deletedAt: null,
          },
        });

        return {
          ...thread,
          unreadCount,
        };
      }),
    );

    return {
      data: threadsWithUnread,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a specific thread with messages
   */
  async getThreadById(threadId: string, userId: string, dto: GetMessagesDto) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      include: {
        order: {
          include: {
            listing: {
              select: { title: true, photos: { take: 1 } },
            },
            buyer: {
              select: {
                id: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    profilePictureUrl: true,
                  },
                },
              },
            },
            seller: {
              select: {
                id: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    profilePictureUrl: true,
                  },
                },
              },
            },
          },
        },
        booking: {
          include: {
            listing: {
              select: { title: true, photos: { take: 1 } },
            },
            buyer: {
              select: {
                id: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    profilePictureUrl: true,
                  },
                },
              },
            },
            seller: {
              select: {
                id: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    profilePictureUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    // Check if user is a participant
    if (!thread.participantIds.includes(userId)) {
      throw new ForbiddenException(
        'You do not have access to this chat thread',
      );
    }

    // Get messages with pagination
    const { limit, before } = dto;
    const where: Prisma.MessageWhereInput = {
      threadId,
      deletedAt: null,
    };

    if (before) {
      const beforeMessage = await this.prisma.message.findUnique({
        where: { id: before },
        select: { sentAt: true },
      });
      if (beforeMessage) {
        where.sentAt = { lt: beforeMessage.sentAt };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });

    return {
      ...thread,
      messages: messages.reverse(), // Reverse to show oldest first
    };
  }

  /**
   * Send a message in a thread
   */
  async sendMessage(threadId: string, userId: string, dto: SendMessageDto) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    if (!thread.participantIds.includes(userId)) {
      throw new ForbiddenException(
        'You do not have access to this chat thread',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        threadId,
        senderId: userId,
        content: dto.content,
        type: dto.type || MessageType.TEXT,
        metadata: dto.metadata || undefined,
        readBy: [userId], // Sender has automatically read it
      },
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
    });

    // Update thread's last message timestamp
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: message.sentAt },
    });

    return message;
  }

  /**
   * Edit a message (within 15 minutes)
   */
  async editMessage(messageId: string, userId: string, dto: EditMessageDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { thread: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    // Check if within 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.sentAt < fifteenMinutesAgo) {
      throw new BadRequestException(
        'Messages can only be edited within 15 minutes',
      );
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { thread: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Message already deleted');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: '[Message deleted]',
      },
    });
  }

  /**
   * Mark thread as read
   */
  async markAsRead(threadId: string, userId: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    if (!thread.participantIds.includes(userId)) {
      throw new ForbiddenException(
        'You do not have access to this chat thread',
      );
    }

    // Get all unread messages in this thread
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        threadId,
        senderId: { not: userId },
        NOT: {
          readBy: { has: userId },
        },
        deletedAt: null,
      },
      select: { id: true, readBy: true },
    });

    // Update each message to add userId to readBy array
    await Promise.all(
      unreadMessages.map((message) =>
        this.prisma.message.update({
          where: { id: message.id },
          data: {
            readBy: {
              push: userId,
            },
          },
        }),
      ),
    );

    return { success: true, markedRead: unreadMessages.length };
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.message.count({
      where: {
        thread: {
          participantIds: {
            has: userId,
          },
        },
        senderId: { not: userId },
        NOT: {
          readBy: { has: userId },
        },
        deletedAt: null,
      },
    });

    return { unreadCount };
  }

  /**
   * Create a chat thread (used internally by orders/bookings)
   */
  async createThread(data: {
    orderId?: string;
    bookingId?: string;
    participantIds: string[];
  }) {
    // Check if thread already exists
    const existingThread = await this.prisma.chatThread.findFirst({
      where: {
        OR: [
          data.orderId ? { orderId: data.orderId } : {},
          data.bookingId ? { bookingId: data.bookingId } : {},
        ].filter((obj) => Object.keys(obj).length > 0),
      },
    });

    if (existingThread) {
      return existingThread;
    }

    return this.prisma.chatThread.create({
      data: {
        orderId: data.orderId,
        bookingId: data.bookingId,
        participantIds: data.participantIds,
      },
    });
  }
}
