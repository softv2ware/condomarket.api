import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '~/auth/guards/jwt-auth.guard';
import { CurrentUser } from '~/auth/decorators/current-user.decorator';
import { BlockingService } from './blocking.service';
import { BlockUserDto } from './dto/block-user.dto';
import { BlockedUserEntity } from './entities/blocked-user.entity';

@Controller('blocking')
@UseGuards(JwtAuthGuard)
export class BlockingController {
  constructor(private readonly blockingService: BlockingService) {}

  /**
   * Block a user
   */
  @Post('block')
  async blockUser(
    @CurrentUser('id') userId: string,
    @Body() dto: BlockUserDto,
  ): Promise<BlockedUserEntity> {
    return this.blockingService.blockUser(userId, dto);
  }

  /**
   * Unblock a user
   */
  @Delete(':blockedId')
  async unblockUser(
    @CurrentUser('id') userId: string,
    @Param('blockedId') blockedId: string,
  ): Promise<{ success: boolean }> {
    return this.blockingService.unblockUser(userId, blockedId);
  }

  /**
   * Get all blocked users
   */
  @Get('blocked')
  async getBlockedUsers(
    @CurrentUser('id') userId: string,
  ): Promise<BlockedUserEntity[]> {
    return this.blockingService.getBlockedUsers(userId);
  }

  /**
   * Get all users who blocked me
   */
  @Get('blockers')
  async getBlockers(
    @CurrentUser('id') userId: string,
  ): Promise<BlockedUserEntity[]> {
    return this.blockingService.getBlockers(userId);
  }

  /**
   * Check if a user is blocked
   */
  @Get('check/:targetId')
  async checkBlocked(
    @CurrentUser('id') userId: string,
    @Param('targetId') targetId: string,
  ): Promise<{ isBlocked: boolean; blockedBy: string | null }> {
    return this.blockingService.areUsersBlocked(userId, targetId);
  }
}
