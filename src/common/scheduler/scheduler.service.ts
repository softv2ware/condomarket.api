import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from '../../orders/orders.service';
import { BookingsService } from '../../bookings/bookings.service';
import { ModerationService } from '../../moderation/moderation.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private ordersService: OrdersService,
    private bookingsService: BookingsService,
    private moderationService: ModerationService,
  ) {}

  // Run every hour to check for expired orders
  @Cron(CronExpression.EVERY_HOUR)
  async handleOrderExpiration() {
    this.logger.log('Running order expiration check...');
    try {
      const result = await this.ordersService.expirePendingOrders();
      this.logger.log(`Expired ${result.expired} pending orders`);
    } catch (error) {
      this.logger.error('Error expiring orders:', error);
    }
  }

  // Run every hour to check for unconfirmed bookings
  @Cron(CronExpression.EVERY_HOUR)
  async handleBookingCancellation() {
    this.logger.log('Running booking cancellation check...');
    try {
      const result = await this.bookingsService.cancelUnconfirmedBookings();
      this.logger.log(`Cancelled ${result.cancelled} unconfirmed bookings`);
    } catch (error) {
      this.logger.error('Error cancelling bookings:', error);
    }
  }

  // Run every hour to check for expired moderation actions
  @Cron(CronExpression.EVERY_HOUR)
  async handleModerationExpiration() {
    this.logger.log('Running moderation expiration check...');
    try {
      const count = await this.moderationService.processExpiredActions();
      this.logger.log(`Expired ${count} moderation actions`);
    } catch (error) {
      this.logger.error('Error expiring moderation actions:', error);
    }
  }

  // You can add more cron jobs here as needed
  // For example, reminder notifications, report generation, reputation recalculation, etc.
}
