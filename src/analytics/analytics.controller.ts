import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Analytics')
@Controller({ path: 'analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Platform Admin Endpoints
  @Get('platform/overview')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({
    summary: 'Get platform-wide analytics overview (Platform Admin)',
  })
  @ApiResponse({ status: 200, description: 'Returns platform overview' })
  async getPlatformOverview() {
    return this.analyticsService.getPlatformOverview();
  }

  @Get('platform/buildings')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Get building statistics (Platform Admin)' })
  @ApiResponse({ status: 200, description: 'Returns building statistics' })
  async getBuildingStatistics() {
    return this.analyticsService.getBuildingStatistics();
  }

  @Get('platform/users/growth')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Get user growth statistics (Platform Admin)' })
  @ApiResponse({ status: 200, description: 'Returns user growth data' })
  async getUserGrowth(@Query('days') days?: string) {
    return this.analyticsService.getUserGrowth(days ? parseInt(days) : 30);
  }

  @Get('platform/subscriptions')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Get subscription metrics (Platform Admin)' })
  @ApiResponse({ status: 200, description: 'Returns subscription metrics' })
  async getSubscriptionMetrics() {
    return this.analyticsService.getSubscriptionMetrics();
  }

  // Building Admin Endpoints
  @Get('buildings/:buildingId/overview')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.BUILDING_ADMIN)
  @ApiOperation({ summary: 'Get building analytics overview' })
  @ApiResponse({ status: 200, description: 'Returns building overview' })
  async getBuildingOverview(@Param('buildingId') buildingId: string) {
    return this.analyticsService.getBuildingOverview(buildingId);
  }

  @Get('buildings/:buildingId/listings')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.BUILDING_ADMIN)
  @ApiOperation({ summary: 'Get building listing performance' })
  @ApiResponse({ status: 200, description: 'Returns listing performance data' })
  async getBuildingListingPerformance(
    @Param('buildingId') buildingId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getBuildingListingPerformance(
      buildingId,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('buildings/:buildingId/top-sellers')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.BUILDING_ADMIN)
  @ApiOperation({ summary: 'Get top sellers in building' })
  @ApiResponse({ status: 200, description: 'Returns top sellers data' })
  async getBuildingTopSellers(
    @Param('buildingId') buildingId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getBuildingTopSellers(
      buildingId,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('buildings/:buildingId/categories')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.BUILDING_ADMIN)
  @ApiOperation({ summary: 'Get category distribution in building' })
  @ApiResponse({ status: 200, description: 'Returns category distribution' })
  async getBuildingCategoryDistribution(
    @Param('buildingId') buildingId: string,
  ) {
    return this.analyticsService.getBuildingCategoryDistribution(buildingId);
  }

  // Seller Endpoints
  @Get('seller/overview')
  @Roles(UserRole.RESIDENT, UserRole.BUILDING_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Get seller analytics overview' })
  @ApiResponse({ status: 200, description: 'Returns seller overview' })
  async getSellerOverview(@CurrentUser('id') userId: string) {
    return this.analyticsService.getSellerOverview(userId);
  }

  @Get('seller/listings')
  @Roles(UserRole.RESIDENT, UserRole.BUILDING_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Get seller listing performance' })
  @ApiResponse({ status: 200, description: 'Returns listing performance data' })
  async getSellerListingPerformance(@CurrentUser('id') userId: string) {
    return this.analyticsService.getSellerListingPerformance(userId);
  }

  @Get('seller/revenue')
  @Roles(UserRole.RESIDENT, UserRole.BUILDING_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Get seller revenue by period' })
  @ApiResponse({ status: 200, description: 'Returns revenue data' })
  async getSellerRevenueByPeriod(
    @CurrentUser('id') userId: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getSellerRevenueByPeriod(
      userId,
      days ? parseInt(days) : 30,
    );
  }
}
