import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { EditReviewDto } from './dto/edit-review.dto';
import { RespondToReviewDto } from './dto/respond-to-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { GetReviewsDto } from './dto/get-reviews.dto';
import { ReviewEntity, RatingSummaryEntity } from './entities/review.entity';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a review for an order or booking' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Review created', type: ReviewEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid data or not completed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Review already exists' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get reviews with filters' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reviews retrieved', type: [ReviewEntity] })
  async getReviews(@Query() query: GetReviewsDto) {
    return this.reviewsService.getReviews(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Review retrieved', type: ReviewEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Review not found' })
  async getReviewById(@Param('id') id: string) {
    return this.reviewsService.getReviewById(id);
  }

  @Patch(':id/respond')
  @ApiOperation({ summary: 'Respond to a review (seller only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Response added', type: ReviewEntity })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the seller' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Already responded' })
  async respondToReview(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RespondToReviewDto,
  ) {
    return this.reviewsService.respondToReview(id, userId, dto);
  }

  @Patch(':id/edit')
  @ApiOperation({ summary: 'Edit a review (within 24 hours)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Review updated', type: ReviewEntity })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the reviewer' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Edit window expired' })
  async editReview(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: EditReviewDto,
  ) {
    return this.reviewsService.editReview(id, userId, dto);
  }

  @Post(':id/report')
  @ApiOperation({ summary: 'Report a review for moderation' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Review reported' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Review not found' })
  async reportReview(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReportReviewDto,
  ) {
    return this.reviewsService.reportReview(id, userId, dto.reason);
  }

  @Get('listings/:listingId')
  @ApiOperation({ summary: 'Get reviews for a specific listing' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Listing reviews retrieved', type: [ReviewEntity] })
  async getListingReviews(
    @Param('listingId') listingId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.getListingReviews(
      listingId,
      pagination.page,
      pagination.limit,
    );
  }

  @Get('users/:userId/given')
  @ApiOperation({ summary: 'Get reviews given by a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User reviews retrieved', type: [ReviewEntity] })
  async getUserReviewsGiven(
    @Param('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.getUserReviews(
      userId,
      'reviewer',
      pagination.page,
      pagination.limit,
    );
  }

  @Get('users/:userId/received')
  @ApiOperation({ summary: 'Get reviews received by a user (as seller)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User reviews retrieved', type: [ReviewEntity] })
  async getUserReviewsReceived(
    @Param('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.getUserReviews(
      userId,
      'reviewee',
      pagination.page,
      pagination.limit,
    );
  }

  @Get('users/:userId/rating-summary')
  @ApiOperation({ summary: 'Get rating summary for a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rating summary retrieved', type: RatingSummaryEntity })
  async getUserRatingSummary(@Param('userId') userId: string) {
    return this.reviewsService.getRatingSummary(userId, 'user');
  }

  @Get('listings/:listingId/rating-summary')
  @ApiOperation({ summary: 'Get rating summary for a listing' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rating summary retrieved', type: RatingSummaryEntity })
  async getListingRatingSummary(@Param('listingId') listingId: string) {
    return this.reviewsService.getRatingSummary(listingId, 'listing');
  }
}
