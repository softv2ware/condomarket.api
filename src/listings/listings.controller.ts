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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../prisma/client';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing (DRAFT status)' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({ status: 400, description: 'Listing limit reached or invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req, @Body() createDto: CreateListingDto) {
    return this.listingsService.create(req.user.userId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Search and filter listings' })
  @ApiResponse({ status: 200, description: 'Listings retrieved successfully' })
  findAll(@Query() searchDto: SearchListingsDto) {
    return this.listingsService.findAll(searchDto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my listings' })
  @ApiResponse({ status: 200, description: 'My listings retrieved successfully' })
  findMyListings(@Req() req, @Query('buildingId') buildingId?: string) {
    return this.listingsService.findMyListings(req.user.userId, buildingId);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured/highlighted listings (PREMIUM tier)' })
  @ApiResponse({ status: 200, description: 'Featured listings retrieved' })
  findFeatured(@Query('buildingId') buildingId?: string) {
    return this.listingsService.findFeatured(buildingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get listing by ID' })
  @ApiResponse({ status: 200, description: 'Listing found' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id, true); // Increment view count
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update listing' })
  @ApiResponse({ status: 200, description: 'Listing updated successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to update this listing' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  update(
    @Param('id') id: string,
    @Req() req,
    @Body() updateDto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete listing (soft delete)' })
  @ApiResponse({ status: 200, description: 'Listing deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this listing' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  remove(@Param('id') id: string, @Req() req) {
    return this.listingsService.remove(id, req.user.userId);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a draft listing' })
  @ApiResponse({ status: 200, description: 'Listing published successfully' })
  @ApiResponse({ status: 400, description: 'Only draft listings can be published' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  publish(@Param('id') id: string, @Req() req) {
    return this.listingsService.publish(id, req.user.userId);
  }

  @Patch(':id/pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pause an active listing' })
  @ApiResponse({ status: 200, description: 'Listing paused successfully' })
  @ApiResponse({ status: 400, description: 'Only active listings can be paused' })
  pause(@Param('id') id: string, @Req() req) {
    return this.listingsService.pause(id, req.user.userId);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a paused listing' })
  @ApiResponse({ status: 200, description: 'Listing activated successfully' })
  @ApiResponse({ status: 400, description: 'Only paused listings can be activated' })
  activate(@Param('id') id: string, @Req() req) {
    return this.listingsService.activate(id, req.user.userId);
  }

  // Admin/Moderation endpoints
  @Get('admin/:buildingId/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDING_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending listings for moderation (Admin only)' })
  @ApiResponse({ status: 200, description: 'Pending listings retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  getPendingListings(@Param('buildingId') buildingId: string) {
    return this.listingsService.getPendingListings(buildingId);
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDING_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a pending listing (Admin only)' })
  @ApiResponse({ status: 200, description: 'Listing approved successfully' })
  @ApiResponse({ status: 400, description: 'Only pending listings can be approved' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  approveListing(@Param('id') id: string) {
    return this.listingsService.approveListing(id);
  }

  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDING_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending listing (Admin only)' })
  @ApiResponse({ status: 200, description: 'Listing rejected successfully' })
  @ApiResponse({ status: 400, description: 'Only pending listings can be rejected' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  rejectListing(@Param('id') id: string, @Body() rejectDto: RejectListingDto) {
    return this.listingsService.rejectListing(id, rejectDto.reason);
  }

  // Saved listings (favorites)
  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle save/unsave listing (add to favorites)' })
  @ApiResponse({ status: 200, description: 'Listing saved/unsaved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  toggleSaveListing(@Param('id') id: string, @Req() req) {
    return this.listingsService.toggleSaveListing(req.user.userId, id);
  }

  @Get('saved/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my saved listings' })
  @ApiResponse({ status: 200, description: 'Saved listings retrieved successfully' })
  getSavedListings(@Req() req, @Query('buildingId') buildingId?: string) {
    return this.listingsService.getSavedListings(req.user.userId, buildingId);
  }

  // Availability management (for services)
  @Get(':id/availability')
  @ApiOperation({ summary: 'Get listing availability (for services)' })
  @ApiResponse({ status: 200, description: 'Availability retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  getAvailability(@Param('id') id: string) {
    return this.listingsService.getAvailability(id);
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update listing availability (for services)' })
  @ApiResponse({ status: 200, description: 'Availability updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid time slots' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  updateAvailability(
    @Param('id') id: string,
    @Req() req,
    @Body() updateDto: any, // Using UpdateAvailabilityDto
  ) {
    return this.listingsService.updateAvailability(
      id,
      req.user.userId,
      updateDto.availability,
    );
  }
}
