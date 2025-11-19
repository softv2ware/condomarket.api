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
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { UpdateAvailabilityDto } from './dto/listing-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, User } from '@prisma/client';
import { AuthRequest } from '~/auth/types/auth.types';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing (DRAFT status)' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Listing limit reached or invalid data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: AuthRequest, @Body() createDto: CreateListingDto) {
    return this.listingsService.create(req.user.id, createDto);
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
  @ApiResponse({
    status: 200,
    description: 'My listings retrieved successfully',
  })
  findMyListings(
    @Req() req: AuthRequest,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.listingsService.findMyListings(req.user.id, buildingId);
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
  @ApiResponse({
    status: 403,
    description: 'Not authorized to update this listing',
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  update(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() updateDto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, req.user.id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete listing (soft delete)' })
  @ApiResponse({ status: 200, description: 'Listing deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to delete this listing',
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.listingsService.remove(id, req.user.id);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a draft listing' })
  @ApiResponse({ status: 200, description: 'Listing published successfully' })
  @ApiResponse({
    status: 400,
    description: 'Only draft listings can be published',
  })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  publish(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.listingsService.publish(id, req.user.id);
  }

  @Patch(':id/pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pause an active listing' })
  @ApiResponse({ status: 200, description: 'Listing paused successfully' })
  @ApiResponse({
    status: 400,
    description: 'Only active listings can be paused',
  })
  pause(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.listingsService.pause(id, req.user.id);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a paused listing' })
  @ApiResponse({ status: 200, description: 'Listing activated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Only paused listings can be activated',
  })
  activate(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.listingsService.activate(id, req.user.id);
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
  @ApiResponse({
    status: 400,
    description: 'Only pending listings can be approved',
  })
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
  @ApiResponse({
    status: 400,
    description: 'Only pending listings can be rejected',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  rejectListing(@Param('id') id: string) {
    return this.listingsService.rejectListing(id);
  }

  // Saved listings (favorites)
  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle save/unsave listing (add to favorites)' })
  @ApiResponse({
    status: 200,
    description: 'Listing saved/unsaved successfully',
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  toggleSaveListing(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.listingsService.toggleSaveListing(req.user.id, id);
  }

  @Get('saved/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my saved listings' })
  @ApiResponse({
    status: 200,
    description: 'Saved listings retrieved successfully',
  })
  getSavedListings(
    @Req() req: AuthRequest,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.listingsService.getSavedListings(req.user.id, buildingId);
  }

  // Availability management (for services)
  @Get(':id/availability')
  @ApiOperation({ summary: 'Get listing availability (for services)' })
  @ApiResponse({
    status: 200,
    description: 'Availability retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  getAvailability(@Param('id') id: string) {
    return this.listingsService.getAvailability(id);
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update listing availability (for services)' })
  @ApiResponse({
    status: 200,
    description: 'Availability updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid time slots' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  updateAvailability(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() updateDto: UpdateAvailabilityDto,
  ) {
    return this.listingsService.updateAvailability(
      id,
      req.user.id,
      updateDto.availability,
    );
  }

  // Photo management endpoints
  @Post(':id/photos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('photos', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload photos to a listing (max 10 photos, 5MB each)',
  })
  @ApiResponse({ status: 201, description: 'Photos uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or limit exceeded' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  uploadPhotos(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    files: Express.Multer.File[],
    @Query('isMain') isMain?: string,
  ) {
    return this.listingsService.uploadPhotos(
      id,
      req.user.id,
      files,
      isMain === 'true',
    );
  }

  @Delete(':id/photos/:photoId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a photo from a listing' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  deletePhoto(@Param('photoId') photoId: string, @Req() req: AuthRequest) {
    return this.listingsService.deletePhoto(photoId, req.user.id);
  }

  @Patch('photos/:photoId/set-main')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a photo as the main photo' })
  @ApiResponse({ status: 200, description: 'Main photo updated successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  setMainPhoto(@Param('photoId') photoId: string, @Req() req: AuthRequest) {
    return this.listingsService.setMainPhoto(photoId, req.user.id);
  }

  @Patch(':id/photos/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder listing photos' })
  @ApiResponse({ status: 200, description: 'Photos reordered successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  reorderPhotos(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() body: { photoOrders: Array<{ photoId: string; order: number }> },
  ) {
    return this.listingsService.reorderPhotos(
      id,
      req.user.id,
      body.photoOrders,
    );
  }
}
