import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private messaging: admin.messaging.Messaging;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    try {
      const projectId = this.configService.get<string>('firebase.projectId');
      const clientEmail = this.configService.get<string>(
        'firebase.clientEmail',
      );
      const privateKey = this.configService.get<string>('firebase.privateKey');
      const databaseURL = this.configService.get<string>(
        'firebase.databaseURL',
      );

      // Only initialize if credentials are provided
      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          databaseURL,
        });

        this.messaging = admin.messaging();
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.logger.warn(
          'Firebase credentials not provided. Push notifications will be disabled.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  /**
   * Send a push notification to a specific device
   */
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.messaging) {
      this.logger.warn(
        'Firebase messaging not initialized. Skipping push notification.',
      );
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
          },
        },
      };

      await this.messaging.send(message);
      this.logger.log(
        `Push notification sent successfully to token: ${token.substring(0, 20)}...`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Send push notifications to multiple devices
   */
  async sendToDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.messaging) {
      this.logger.warn(
        'Firebase messaging not initialized. Skipping push notifications.',
      );
      return { successCount: 0, failureCount: tokens.length };
    }

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: data || {},
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
          },
        },
      };

      const response = await this.messaging.sendEachForMulticast(message);

      this.logger.log(
        `Push notifications sent: ${response.successCount} succeeded, ${response.failureCount} failed`,
      );

      // Log failed tokens for debugging
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.warn(
              `Failed to send to token ${tokens[idx].substring(0, 20)}...: ${resp.error?.message}`,
            );
          }
        });
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`Failed to send push notifications: ${error.message}`);
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  /**
   * Send a push notification to a topic
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.messaging) {
      this.logger.warn(
        'Firebase messaging not initialized. Skipping push notification.',
      );
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title,
          body,
        },
        data: data || {},
      };

      await this.messaging.send(message);
      this.logger.log(`Push notification sent successfully to topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send push notification to topic: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Subscribe a device token to a topic
   */
  async subscribeToTopic(
    tokens: string | string[],
    topic: string,
  ): Promise<void> {
    if (!this.messaging) {
      this.logger.warn(
        'Firebase messaging not initialized. Skipping topic subscription.',
      );
      return;
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      await this.messaging.subscribeToTopic(tokenArray, topic);
      this.logger.log(
        `Subscribed ${tokenArray.length} token(s) to topic: ${topic}`,
      );
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic: ${error.message}`);
    }
  }

  /**
   * Unsubscribe a device token from a topic
   */
  async unsubscribeFromTopic(
    tokens: string | string[],
    topic: string,
  ): Promise<void> {
    if (!this.messaging) {
      this.logger.warn(
        'Firebase messaging not initialized. Skipping topic unsubscription.',
      );
      return;
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      await this.messaging.unsubscribeFromTopic(tokenArray, topic);
      this.logger.log(
        `Unsubscribed ${tokenArray.length} token(s) from topic: ${topic}`,
      );
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic: ${error.message}`);
    }
  }
}
