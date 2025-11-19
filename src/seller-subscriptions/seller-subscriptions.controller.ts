import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SellerSubscriptionsService } from './seller-subscriptions.service';
import { CreateSellerSubscriptionDto } from './dto/create-seller-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { OverrideSubscriptionDto } from './dto/override-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, SubscriptionStatus } from '@prisma/client';

@ApiTags('Seller-Subscriptions')
@Controller('seller-subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SellerSubscriptionsController {
  constructor(
    private readonly sellerSubscriptionsService: SellerSubscriptionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Subscribe to a plan' })
  create(
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateSellerSubscriptionDto,
  ) {
    return this.sellerSubscriptionsService.subscribe(userId, createDto);
  }

  @Get('my-subscriptions')
  @ApiOperation({ summary: 'Get my subscriptions' })
  getMySubscriptions(@CurrentUser('id') userId: string) {
    return this.sellerSubscriptionsService.getMySubscriptions(userId);
  }

  @Get('can-create-listing/:buildingId')
  @ApiOperation({
    summary: 'Check if user can create a listing in a building',
    description:
      'Returns whether user has reached their listing limit for the specified building',
  })
  canCreateListing(
    @CurrentUser('id') userId: string,
    @Param('buildingId') buildingId: string,
  ) {
    return this.sellerSubscriptionsService.canCreateListing(userId, buildingId);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Admin: Get all subscriptions with filters' })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus })
  findAll(
    @Query('buildingId') buildingId?: string,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.sellerSubscriptionsService.findAll(buildingId, status);
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Admin: Get subscription statistics' })
  @ApiQuery({ name: 'buildingId', required: false })
  getStats(@Query('buildingId') buildingId?: string) {
    return this.sellerSubscriptionsService.getSubscriptionStats(buildingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.sellerSubscriptionsService.findOne(id, userId);
  }

  @Patch(':id/change-plan')
  @ApiOperation({ summary: 'Change subscription plan' })
  changePlan(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() changePlanDto: ChangePlanDto,
  ) {
    return this.sellerSubscriptionsService.changePlan(
      id,
      userId,
      changePlanDto,
    );
  }

  @Post('admin/:id/override')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Admin: Override subscription status' })
  overrideSubscription(
    @Param('id') id: string,
    @Body() overrideDto: OverrideSubscriptionDto,
  ) {
    return this.sellerSubscriptionsService.overrideSubscription(
      id,
      overrideDto.status,
      overrideDto.reason,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel subscription' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() cancelDto?: CancelSubscriptionDto,
  ) {
    return this.sellerSubscriptionsService.cancel(id, userId, cancelDto);
  }
}
