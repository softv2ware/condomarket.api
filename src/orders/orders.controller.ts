import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Order } from './entities/order.entity';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: Order,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.create(createOrderDto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for the current user' })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['buyer', 'seller'],
    description: 'Filter by buyer or seller role',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: [Order],
  })
  findAll(
    @Query('role') role: 'buyer' | 'seller' | undefined,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.findAll(user.userId, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific order' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: Order,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.findOne(id, user.userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
    type: Order,
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.updateStatus(
      id,
      updateOrderStatusDto,
      user.userId,
    );
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm an order (seller only)' })
  @ApiResponse({
    status: 200,
    description: 'Order confirmed successfully',
    type: Order,
  })
  confirm(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.confirm(id, user.userId);
  }

  @Patch(':id/ready-for-pickup')
  @ApiOperation({ summary: 'Mark order ready for pickup (seller only)' })
  @ApiResponse({
    status: 200,
    description: 'Order marked ready for pickup',
    type: Order,
  })
  markReadyForPickup(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.markReadyForPickup(id, user.userId);
  }

  @Patch(':id/out-for-delivery')
  @ApiOperation({ summary: 'Mark order out for delivery (seller only)' })
  @ApiResponse({
    status: 200,
    description: 'Order marked out for delivery',
    type: Order,
  })
  markOutForDelivery(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.markOutForDelivery(id, user.userId);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark order as completed' })
  @ApiResponse({
    status: 200,
    description: 'Order marked as completed',
    type: Order,
  })
  complete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.complete(id, user.userId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: Order,
  })
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ordersService.cancel(id, user.userId, reason);
  }
}
