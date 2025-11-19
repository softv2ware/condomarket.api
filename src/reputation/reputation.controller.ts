import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/auth/guards/jwt-auth.guard';
import { RolesGuard } from '~/auth/guards/roles.guard';
import { Roles } from '~/auth/decorators/roles.decorator';
import { ReputationService } from './reputation.service';
import { ReputationEntity } from './entities/reputation.entity';

@ApiTags('Reputation')
@Controller('reputation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  /**
   * Get user reputation
   */
  @Get(':userId')
  async getReputation(
    @Param('userId') userId: string,
  ): Promise<ReputationEntity> {
    return this.reputationService.getReputation(userId);
  }

  /**
   * Recalculate user reputation (Admin only)
   */
  @Post(':userId/calculate')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  async calculateReputation(
    @Param('userId') userId: string,
  ): Promise<ReputationEntity> {
    return this.reputationService.calculateReputation(userId);
  }

  /**
   * Recalculate all user reputations (Admin only)
   */
  @Post('recalculate-all')
  @Roles('PLATFORM_ADMIN')
  async recalculateAll(): Promise<{ processed: number }> {
    const count = await this.reputationService.recalculateAllReputations();
    return { processed: count };
  }

  /**
   * Get top-rated users leaderboard
   */
  @Get('leaderboard/top-rated')
  async getTopRated(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ): Promise<ReputationEntity[]> {
    return this.reputationService.getTopRatedUsers(limit);
  }

  /**
   * Get trusted sellers leaderboard
   */
  @Get('leaderboard/trusted-sellers')
  async getTrustedSellers(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ): Promise<ReputationEntity[]> {
    return this.reputationService.getTrustedSellers(limit);
  }
}
