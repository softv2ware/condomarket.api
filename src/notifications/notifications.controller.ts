import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Delete,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '~/auth/guards/jwt-auth.guard';
import { CurrentUser } from '~/auth/decorators/current-user.decorator';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification (admin/system use)' })
  @ApiResponse({ status: 201, type: NotificationEntity })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, type: [NotificationEntity] })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query() dto: GetNotificationsDto,
  ) {
    return this.notificationsService.getNotifications(userId, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, schema: { properties: { count: { type: 'number' } } } })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, type: [NotificationPreferenceEntity] })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preference' })
  @ApiResponse({ status: 200, type: NotificationPreferenceEntity })
  async updatePreference(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreference(userId, dto);
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({ status: 200, schema: { properties: { count: { type: 'number' } } } })
  async markAsRead(@CurrentUser('id') userId: string, @Body() dto: MarkReadDto) {
    return this.notificationsService.markAsRead(userId, dto.notificationIds);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, schema: { properties: { count: { type: 'number' } } } })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: 200, type: NotificationEntity })
  async getNotificationById(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.getNotificationById(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 204 })
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.notificationsService.deleteNotification(id, userId);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  @ApiResponse({ status: 201 })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    await this.notificationsService.registerDevice(userId, dto);
    return { message: 'Device registered successfully' };
  }

  @Delete('devices/:token')
  @ApiOperation({ summary: 'Unregister a device token' })
  @ApiResponse({ status: 204 })
  async unregisterDevice(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
  ) {
    await this.notificationsService.unregisterDevice(userId, token);
  }

  @Get('devices')
  @ApiOperation({ summary: 'Get all registered devices' })
  @ApiResponse({ status: 200 })
  async getUserDevices(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUserDevices(userId);
  }
}
