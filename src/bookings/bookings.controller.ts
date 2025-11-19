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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Booking } from './entities/booking.entity';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking for a service' })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  @ApiResponse({ status: 409, description: 'Time slot conflict' })
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.bookingsService.create(createBookingDto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings for the current user' })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['buyer', 'seller'],
    description: 'Filter by buyer or seller role',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings retrieved successfully',
    type: [Booking],
  })
  findAll(
    @Query('role') role: 'buyer' | 'seller' | undefined,
    @CurrentUser() user: { userId: string },
  ) {
    return this.bookingsService.findAll(user.userId, role);
  }

  @Get('available-slots/:listingId')
  @ApiOperation({ summary: 'Get available time slots for a service' })
  @ApiParam({
    name: 'listingId',
    description: 'ID of the service listing',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    description: 'Date in YYYY-MM-DD format',
    example: '2024-11-20',
  })
  @ApiResponse({
    status: 200,
    description: 'Available slots retrieved successfully',
  })
  getAvailableSlots(
    @Param('listingId') listingId: string,
    @Query('date') date: string,
  ) {
    return this.bookingsService.getAvailableSlots(listingId, date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific booking' })
  @ApiResponse({
    status: 200,
    description: 'Booking retrieved successfully',
    type: Booking,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.bookingsService.findOne(id, user.userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  @ApiResponse({
    status: 200,
    description: 'Booking status updated successfully',
    type: Booking,
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateBookingStatusDto: UpdateBookingStatusDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.bookingsService.updateStatus(
      id,
      updateBookingStatusDto,
      user.userId,
    );
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm a booking (seller only)' })
  @ApiResponse({
    status: 200,
    description: 'Booking confirmed successfully',
    type: Booking,
  })
  confirm(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.bookingsService.confirm(id, user.userId);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Start the service (seller only)' })
  @ApiResponse({
    status: 200,
    description: 'Service started successfully',
    type: Booking,
  })
  startService(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.bookingsService.startService(id, user.userId);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark booking as completed' })
  @ApiResponse({
    status: 200,
    description: 'Booking marked as completed',
    type: Booking,
  })
  complete(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.bookingsService.complete(id, user.userId);
  }

  @Patch(':id/no-show')
  @ApiOperation({ summary: 'Mark buyer as no-show (seller only)' })
  @ApiResponse({
    status: 200,
    description: 'Booking marked as no-show',
    type: Booking,
  })
  markNoShow(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: { userId: string },
  ) {
    return this.bookingsService.markNoShow(id, user.userId, reason);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled successfully',
    type: Booking,
  })
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: { userId: string },
  ) {
    return this.bookingsService.cancel(id, user.userId, reason);
  }
}
