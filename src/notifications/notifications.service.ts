import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '~/prisma';
import { NotificationType, NotificationChannel, Prisma } from '@prisma/client';
import { FirebaseService } from '~/common/firebase/firebase.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Create a new notification
   * Checks user preferences before creating and filters channels accordingly
   */
  async create(dto: CreateNotificationDto): Promise<NotificationEntity> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user's notification preferences for this type
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        userId: dto.userId,
        type: dto.type,
        enabled: true,
      },
    });

    // Determine which channels to use
    let channels = dto.channels || [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.PUSH,
    ];

    // Filter channels based on user preferences
    // If user has preferences, only use enabled channels
    if (preferences.length > 0) {
      const enabledChannels = preferences.map((p) => p.channel);
      channels = channels.filter((c) => enabledChannels.includes(c));
    }

    // If no channels are enabled, only create in-app notification
    if (channels.length === 0) {
      channels = [NotificationChannel.IN_APP];
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        channels,
        data: dto.data || {},
      },
    });

    // Send push notification if PUSH channel is enabled
    if (channels.includes(NotificationChannel.PUSH)) {
      await this.sendPushNotification(
        dto.userId,
        dto.title,
        dto.message,
        dto.data,
      );
    }

    // TODO: Implement EMAIL channel (Stage 7 - Email service)
    // if (channels.includes(NotificationChannel.EMAIL)) {
    //   await this.sendEmailNotification(...);
    // }

    return new NotificationEntity({
      ...notification,
      data: notification.data as Record<string, any> | undefined,
      readAt: notification.readAt || undefined,
      createdAt: notification.sentAt,
    });
  }

  /**
   * Send push notification to all user's registered devices
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      // Get all active device tokens for the user
      const devices = await this.prisma.deviceToken.findMany({
        where: { userId },
      });

      if (devices.length === 0) {
        this.logger.debug(`No device tokens found for user ${userId}`);
        return;
      }

      const tokens = devices.map((d) => d.token);

      // Convert data object values to strings (FCM requirement)
      const stringData: Record<string, string> = {};
      if (data) {
        Object.keys(data).forEach((key) => {
          stringData[key] = String(data[key]);
        });
      }

      // Send to all devices
      const result = await this.firebaseService.sendToDevices(
        tokens,
        title,
        message,
        stringData,
      );

      this.logger.log(
        `Push notification sent to user ${userId}: ${result.successCount} succeeded, ${result.failureCount} failed`,
      );

      // Optionally: Remove invalid tokens
      // if (result.failureCount > 0) {
      //   await this.removeInvalidTokens(userId, failedTokens);
      // }
    } catch (error) {
      this.logger.error(
        `Failed to send push notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get user's notifications with filtering and pagination
   */
  async getNotifications(userId: string, dto: GetNotificationsDto) {
    const { type, isRead, page = 1, limit = 20 } = dto;

    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (type) {
      where.type = type;
    }

    if (isRead !== undefined) {
      where.readAt = isRead ? { not: null } : null;
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map(
        (n) =>
          new NotificationEntity({
            ...n,
            data: n.data as Record<string, any> | undefined,
            readAt: n.readAt || undefined,
            createdAt: n.sentAt,
          }),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(
    id: string,
    userId: string,
  ): Promise<NotificationEntity> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return new NotificationEntity({
      ...notification,
      data: notification.data as Record<string, any> | undefined,
      readAt: notification.readAt || undefined,
      createdAt: notification.sentAt,
    });
  }

  /**
   * Mark specific notifications as read
   */
  async markAsRead(
    userId: string,
    notificationIds: string[],
  ): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Mark all user's notifications as read
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });

    return { count };
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(
    userId: string,
  ): Promise<NotificationPreferenceEntity[]> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    });

    return preferences.map((p) => new NotificationPreferenceEntity(p));
  }

  /**
   * Update user's notification preference
   */
  async updatePreference(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreferenceEntity> {
    // Upsert the preference
    const preference = await this.prisma.notificationPreference.upsert({
      where: {
        userId_channel_type: {
          userId,
          channel: dto.channel,
          type: dto.type,
        },
      },
      create: {
        userId,
        type: dto.type,
        channel: dto.channel,
        enabled: dto.enabled,
      },
      update: {
        enabled: dto.enabled,
      },
    });

    return new NotificationPreferenceEntity(preference);
  }

  /**
   * Initialize default preferences for a new user
   * All channels enabled for all notification types by default
   */
  async initializePreferences(userId: string): Promise<void> {
    const notificationTypes = Object.values(NotificationType);
    const channels = Object.values(NotificationChannel);

    const preferences: Prisma.NotificationPreferenceCreateManyInput[] = [];

    for (const type of notificationTypes) {
      for (const channel of channels) {
        preferences.push({
          userId,
          type,
          channel,
          enabled: true,
        });
      }
    }

    await this.prisma.notificationPreference.createMany({
      data: preferences,
      skipDuplicates: true,
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id },
    });
  }

  /**
   * Register a device token for push notifications
   */
  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<void> {
    try {
      await this.prisma.deviceToken.upsert({
        where: { token: dto.token },
        create: {
          userId,
          token: dto.token,
          deviceType: dto.deviceType,
          deviceName: dto.deviceName,
        },
        update: {
          userId, // Update user if token is reassigned
          deviceType: dto.deviceType,
          deviceName: dto.deviceName,
          lastUsedAt: new Date(),
        },
      });

      this.logger.log(`Device token registered for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to register device token: ${error.message}`);
      throw new BadRequestException('Failed to register device token');
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    try {
      const device = await this.prisma.deviceToken.findUnique({
        where: { token },
      });

      if (!device) {
        throw new NotFoundException('Device token not found');
      }

      if (device.userId !== userId) {
        throw new NotFoundException('Device token not found');
      }

      await this.prisma.deviceToken.delete({
        where: { token },
      });

      this.logger.log(`Device token unregistered for user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to unregister device token: ${error.message}`);
      throw new BadRequestException('Failed to unregister device token');
    }
  }

  /**
   * Get all registered devices for a user
   */
  async getUserDevices(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        token: true,
        deviceType: true,
        deviceName: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }
}
