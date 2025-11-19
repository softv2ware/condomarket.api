import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Stage 6: Chat, Reviews, and Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let buyerToken: string;
  let sellerToken: string;
  let buyerId: string;
  let sellerId: string;
  let listingId: string;
  let orderId: string;
  let bookingId: string;
  let chatThreadId: string;
  let messageId: string;
  let reviewId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Clean database (order matters for foreign key constraints)
    await prisma.message.deleteMany();
    await prisma.chatThread.deleteMany();
    await prisma.review.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.order.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.sellerSubscription.deleteMany();
    await prisma.invitationCode.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('User Registration with Notification Preferences', () => {
    it('should register a buyer and initialize notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'buyer@test.com',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Buyer',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe('buyer@test.com');

      buyerToken = response.body.accessToken;
      buyerId = response.body.user.id;

      // Verify notification preferences were initialized
      const preferences = await prisma.notificationPreference.findMany({
        where: { userId: buyerId },
      });

      // Should have 19 notification types × 3 channels = 57 preferences
      expect(preferences.length).toBe(57);

      // All should be enabled by default
      const allEnabled = preferences.every((pref) => pref.enabled);
      expect(allEnabled).toBe(true);
    });

    it('should register a seller and initialize notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'seller@test.com',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Seller',
        })
        .expect(201);

      sellerToken = response.body.accessToken;
      sellerId = response.body.user.id;

      // Update user role to SELLER
      await prisma.user.update({
        where: { id: sellerId },
        data: { role: 'SELLER' as any },
      });

      // Verify notification preferences
      const preferences = await prisma.notificationPreference.findMany({
        where: { userId: sellerId },
      });

      expect(preferences.length).toBe(57);
    });
  });

  describe('Setup: Create Listing and Subscription', () => {
    it('should create a seller subscription', async () => {
      // Create a subscription plan first
      const plan = await prisma.subscriptionPlan.create({
        data: {
          name: 'Basic Plan',
          price: 29.99,
          billingCycle: 'MONTHLY',
          maxListings: 10,
          features: ['Feature 1', 'Feature 2'],
        } as any,
      });

      // Create seller subscription
      const subscription = await prisma.sellerSubscription.create({
        data: {
          userId: sellerId,
          planId: plan.id,
          status: 'ACTIVE',
        } as any,
      });

      expect(subscription.status).toBe('ACTIVE');
    });

    it('should create a listing for testing', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Electronics',
          description: 'Electronic items',
          slug: 'electronics',
          type: 'PRODUCT',
        } as any,
      });

      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          title: 'Test Product',
          description: 'A test product for e2e testing',
          price: 99.99,
          type: 'PRODUCT',
          categoryId: category.id,
          status: 'ACTIVE',
        })
        .expect(201);

      listingId = response.body.id;
      expect(response.body.title).toBe('Test Product');
    });
  });

  describe('Order Flow with Chat and Notifications', () => {
    it('should create an order and trigger ORDER_PLACED notification', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          listingId,
          quantity: 1,
          totalAmount: 99.99,
        })
        .expect(201);

      orderId = response.body.id;
      expect(response.body.status).toBe('PENDING');

      // Wait a bit for notification to be created
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify ORDER_PLACED notification was sent to seller
      const notifications = await prisma.notification.findMany({
        where: {
          userId: sellerId,
          type: 'ORDER_PLACED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].title).toContain('New Order');
    });

    it('should confirm order and create chat thread', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');

      // Wait for chat thread creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify chat thread was created
      const threads = await prisma.chatThread.findMany({
        where: {
          orderId,
        },
      });

      expect(threads.length).toBe(1);
      chatThreadId = threads[0].id;
      expect(threads[0].participantIds).toContain(buyerId);
      expect(threads[0].participantIds).toContain(sellerId);

      // Verify ORDER_CONFIRMED notification was sent to buyer
      const notifications = await prisma.notification.findMany({
        where: {
          userId: buyerId,
          type: 'ORDER_CONFIRMED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should mark order as ready and notify buyer', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/ready`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.status).toBe('READY');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify ORDER_READY notification
      const notifications = await prisma.notification.findMany({
        where: {
          userId: buyerId,
          type: 'ORDER_READY',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should deliver order and notify buyer', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.status).toBe('DELIVERED');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify ORDER_DELIVERED notification
      const notifications = await prisma.notification.findMany({
        where: {
          userId: buyerId,
          type: 'ORDER_DELIVERED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe('Chat Functionality', () => {
    it('should get chat threads for buyer', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/threads')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.threads.length).toBeGreaterThan(0);
      expect(response.body.threads[0].id).toBe(chatThreadId);
    });

    it('should send a message in the chat thread', async () => {
      const response = await request(app.getHttpServer())
        .post(`/chat/threads/${chatThreadId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          content: 'Hello, when can I pick up the order?',
        })
        .expect(201);

      messageId = response.body.id;
      expect(response.body.content).toBe(
        'Hello, when can I pick up the order?',
      );
      expect(response.body.senderId).toBe(buyerId);
    });

    it('should get messages from the thread', async () => {
      const response = await request(app.getHttpServer())
        .get(`/chat/threads/${chatThreadId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.messages.length).toBe(1);
      expect(response.body.messages[0].content).toBe(
        'Hello, when can I pick up the order?',
      );
    });

    it('should edit a message within 15 minutes', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          content: 'Hello, when can I pick up the order? Thanks!',
        })
        .expect(200);

      expect(response.body.content).toBe(
        'Hello, when can I pick up the order? Thanks!',
      );
      expect(response.body.editedAt).toBeTruthy();
    });

    it('should mark thread as read', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/chat/threads/${chatThreadId}/read`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.message).toContain('marked as read');
    });

    it('should get unread count', async () => {
      // Send another message as seller
      await request(app.getHttpServer())
        .post(`/chat/threads/${chatThreadId}/messages`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          content: 'You can pick it up tomorrow!',
        })
        .expect(201);

      // Check buyer's unread count
      const response = await request(app.getHttpServer())
        .get('/chat/unread-count')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.unreadCount).toBeGreaterThan(0);
    });
  });

  describe('Review Flow with Notifications', () => {
    it('should complete order before creating review', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/complete`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify ORDER_COMPLETED notification sent to seller
      const notifications = await prisma.notification.findMany({
        where: {
          userId: sellerId,
          type: 'ORDER_COMPLETED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should create a review and notify seller', async () => {
      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          listingId,
          orderId,
          reviewType: 'ORDER',
          rating: 5,
          comment: 'Great product, fast delivery!',
        })
        .expect(201);

      reviewId = response.body.id;
      expect(response.body.rating).toBe(5);
      expect(response.body.reviewerId).toBe(buyerId);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify REVIEW_RECEIVED notification sent to seller
      const notifications = await prisma.notification.findMany({
        where: {
          userId: sellerId,
          type: 'REVIEW_RECEIVED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].message).toContain('5 stars');
    });

    it('should respond to review and notify reviewer', async () => {
      const response = await request(app.getHttpServer())
        .post(`/reviews/${reviewId}/respond`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          response: 'Thank you for your purchase! Glad you liked it.',
        })
        .expect(200);

      expect(response.body.sellerResponse).toBe(
        'Thank you for your purchase! Glad you liked it.',
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify REVIEW_RESPONSE notification sent to buyer
      const notifications = await prisma.notification.findMany({
        where: {
          userId: buyerId,
          type: 'REVIEW_RESPONSE',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should edit review within 24 hours', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 4,
          comment:
            'Great product, fast delivery! Update: packaging could be better.',
        })
        .expect(200);

      expect(response.body.rating).toBe(4);
      expect(response.body.editedAt).toBeTruthy();
    });

    it('should get rating summary for listing', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reviews/listings/${listingId}/summary`)
        .expect(200);

      expect(response.body.averageRating).toBe(4);
      expect(response.body.totalReviews).toBe(1);
      expect(response.body.ratingDistribution).toHaveProperty('5');
    });

    it('should get listing reviews', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reviews/listings/${listingId}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.reviews.length).toBe(1);
      expect(response.body.reviews[0].rating).toBe(4);
      expect(response.body.reviews[0].sellerResponse).toBeTruthy();
    });
  });

  describe('Booking Flow with Chat and Notifications', () => {
    let serviceListingId: string;

    it('should create a service listing', async () => {
      const category = await prisma.category.findFirst();

      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          title: 'Cleaning Service',
          description: 'Professional cleaning service',
          price: 50.0,
          type: 'SERVICE',
          categoryId: category?.id,
          status: 'ACTIVE',
        })
        .expect(201);

      serviceListingId = response.body.id;
    });

    it('should create a booking and trigger BOOKING_REQUESTED notification', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const endTime = new Date(Date.now() + 26 * 60 * 60 * 1000); // Tomorrow + 2 hours

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          listingId: serviceListingId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          totalAmount: 50.0,
        })
        .expect(201);

      bookingId = response.body.id;
      expect(response.body.status).toBe('PENDING');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify BOOKING_REQUESTED notification
      const notifications = await prisma.notification.findMany({
        where: {
          userId: sellerId,
          type: 'BOOKING_REQUESTED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should confirm booking and create chat thread', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify chat thread was created
      const threads = await prisma.chatThread.findMany({
        where: {
          bookingId,
        },
      });

      expect(threads.length).toBe(1);

      // Verify BOOKING_CONFIRMED notification
      const notifications = await prisma.notification.findMany({
        where: {
          userId: buyerId,
          type: 'BOOKING_CONFIRMED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should start booking and notify buyer', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.status).toBe('IN_PROGRESS');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify BOOKING_STARTED notification
      const notifications = await prisma.notification.findMany({
        where: {
          userId: buyerId,
          type: 'BOOKING_STARTED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should complete booking and notify seller', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify BOOKING_COMPLETED notification
      const notifications = await prisma.notification.findMany({
        where: {
          userId: sellerId,
          type: 'BOOKING_COMPLETED',
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe('Notification Management', () => {
    it('should get user notifications', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${buyerToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.notifications.length).toBeGreaterThan(0);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it('should mark notification as read', async () => {
      const notification = await prisma.notification.findFirst({
        where: { userId: buyerId, readAt: null },
      });

      if (notification) {
        await request(app.getHttpServer())
          .patch(`/notifications/${notification.id}/read`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);

        const updated = await prisma.notification.findUnique({
          where: { id: notification.id },
        });

        expect(updated?.readAt).toBeTruthy();
      }
    });

    it('should get unread count', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });

    it('should update notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .patch('/notifications/preferences')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          type: 'ORDER_PLACED',
          channel: 'EMAIL',
          enabled: false,
        })
        .expect(200);

      expect(response.body.enabled).toBe(false);
    });

    it('should get notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/preferences')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(57);

      // Find the updated preference
      const emailPref = response.body.find(
        (p) => p.type === 'ORDER_PLACED' && p.channel === 'EMAIL',
      );
      expect(emailPref.enabled).toBe(false);
    });
  });

  describe('Device Token Management', () => {
    const testToken = 'test-fcm-token-12345';

    it('should register a device token', async () => {
      const response = await request(app.getHttpServer())
        .post('/notifications/devices')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          token: testToken,
          deviceType: 'ios',
          deviceName: 'iPhone 13',
        })
        .expect(201);

      expect(response.body.token).toBe(testToken);
      expect(response.body.deviceType).toBe('ios');
    });

    it('should get user devices', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/devices')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].token).toBe(testToken);
    });

    it('should unregister a device token', async () => {
      await request(app.getHttpServer())
        .delete(`/notifications/devices/${testToken}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      // Verify device was deleted
      const devices = await prisma.deviceToken.findMany({
        where: { token: testToken },
      });

      expect(devices.length).toBe(0);
    });
  });

  describe('Chat Message Management', () => {
    let tempMessageId: string;

    it('should delete a message', async () => {
      // Create a new message
      const createResponse = await request(app.getHttpServer())
        .post(`/chat/threads/${chatThreadId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          content: 'This message will be deleted',
        })
        .expect(201);

      tempMessageId = createResponse.body.id;

      // Delete the message
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/chat/messages/${tempMessageId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(deleteResponse.body.deletedAt).toBeTruthy();
      expect(deleteResponse.body.content).toBe('[Message deleted]');
    });

    it('should not allow editing message after 15 minutes', async () => {
      // Create an old message (simulate by updating database directly)
      const oldMessage = await prisma.message.create({
        data: {
          threadId: chatThreadId,
          senderId: buyerId,
          content: 'Old message',
          sentAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        },
      });

      // Try to edit it
      await request(app.getHttpServer())
        .patch(`/chat/messages/${oldMessage.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          content: 'Edited content',
        })
        .expect(400);
    });
  });

  describe('Review Edge Cases', () => {
    it('should not allow review editing after 24 hours', async () => {
      // Create an old review
      const oldReview = await prisma.review.create({
        data: {
          listingId,
          reviewerId: buyerId,
          revieweeId: sellerId,
          orderId,
          type: 'ORDER',
          rating: 3,
          comment: 'Old review',
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        } as any,
      });

      // Try to edit it
      await request(app.getHttpServer())
        .patch(`/reviews/${oldReview.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 5,
        })
        .expect(400);
    });

    it('should report a review', async () => {
      const response = await request(app.getHttpServer())
        .post(`/reviews/${reviewId}/report`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          reason: 'Inappropriate content',
        })
        .expect(200);

      expect(response.body.status).toBe('FLAGGED');
    });

    it('should get user reviews as reviewer', async () => {
      const response = await request(app.getHttpServer())
        .get('/reviews/my-reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.reviews.length).toBeGreaterThan(0);
      expect(response.body.reviews[0].reviewerId).toBe(buyerId);
    });

    it('should get user reviews as reviewee', async () => {
      const response = await request(app.getHttpServer())
        .get('/reviews/received')
        .set('Authorization', `Bearer ${sellerToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.reviews.length).toBeGreaterThan(0);
      expect(response.body.reviews[0].revieweeId).toBe(sellerId);
    });
  });

  describe('Notification Statistics', () => {
    it('should verify total notifications created', async () => {
      const buyerNotifications = await prisma.notification.count({
        where: { userId: buyerId },
      });

      const sellerNotifications = await prisma.notification.count({
        where: { userId: sellerId },
      });

      // Buyer should have notifications for: ORDER_CONFIRMED, ORDER_READY, ORDER_DELIVERED,
      // BOOKING_CONFIRMED, BOOKING_STARTED, REVIEW_RESPONSE
      expect(buyerNotifications).toBeGreaterThanOrEqual(6);

      // Seller should have notifications for: ORDER_PLACED, ORDER_COMPLETED,
      // BOOKING_REQUESTED, BOOKING_COMPLETED, REVIEW_RECEIVED
      expect(sellerNotifications).toBeGreaterThanOrEqual(5);
    });

    it('should verify chat threads created', async () => {
      const threads = await prisma.chatThread.count();

      // Should have 2 threads (one for order, one for booking)
      expect(threads).toBe(2);
    });

    it('should verify messages sent', async () => {
      const messages = await prisma.message.count({
        where: { deletedAt: null },
      });

      expect(messages).toBeGreaterThan(0);
    });
  });
});
