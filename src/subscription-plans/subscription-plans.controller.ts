import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('subscription-plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create subscription plan (Platform Admin only)' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @ApiResponse({ status: 409, description: 'Plan with this tier already exists' })
  create(@Body() createSubscriptionPlanDto: CreateSubscriptionPlanDto) {
    return this.subscriptionPlansService.create(createSubscriptionPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscription plans' })
  @ApiQuery({
    name: 'buildingId',
    required: false,
    description: 'Filter plans for specific building',
  })
  @ApiResponse({ status: 200, description: 'List of subscription plans' })
  findAll(@Query('buildingId') buildingId?: string) {
    return this.subscriptionPlansService.findAll(buildingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription plan by ID' })
  @ApiResponse({ status: 200, description: 'Subscription plan details' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  findOne(@Param('id') id: string) {
    return this.subscriptionPlansService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update subscription plan (Platform Admin only)' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  update(
    @Param('id') id: string,
    @Body() updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlansService.update(id, updateSubscriptionPlanDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete subscription plan (soft delete, Platform Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  remove(@Param('id') id: string) {
    return this.subscriptionPlansService.remove(id);
  }
}
