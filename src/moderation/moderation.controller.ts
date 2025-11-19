import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ModerationService } from './moderation.service';
import { CreateModerationActionDto } from './dto/create-moderation-action.dto';
import { GetModerationActionsDto } from './dto/get-moderation-actions.dto';
import { RevokeModerationDto } from './dto/revoke-moderation.dto';
import { ModerationActionEntity } from './entities/moderation-action.entity';
import { JwtAuthGuard } from '~/auth/guards/jwt-auth.guard';
import { RolesGuard } from '~/auth/guards/roles.guard';
import { Roles } from '~/auth/decorators/roles.decorator';
import { CurrentUser } from '~/auth/decorators/current-user.decorator';

@ApiTags('moderation')
@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('actions')
  @ApiOperation({ summary: 'Create a moderation action (Admin)' })
  @ApiResponse({ status: 201, description: 'Moderation action created', type: ModerationActionEntity })
  @HttpCode(HttpStatus.CREATED)
  async createAction(
    @CurrentUser('id') moderatorId: string,
    @Body() dto: CreateModerationActionDto,
  ): Promise<ModerationActionEntity> {
    return this.moderationService.createAction(moderatorId, dto);
  }

  @Post('warn')
  @ApiOperation({ summary: 'Warn a user (Admin)' })
  @ApiResponse({ status: 201, description: 'Warning issued', type: ModerationActionEntity })
  @HttpCode(HttpStatus.CREATED)
  async warnUser(
    @CurrentUser('id') moderatorId: string,
    @Body() body: { userId: string; reason: string; buildingId?: string },
  ): Promise<ModerationActionEntity> {
    return this.moderationService.warnUser(
      moderatorId,
      body.userId,
      body.reason,
      body.buildingId,
    );
  }

  @Post('restrict')
  @ApiOperation({ summary: 'Restrict user actions (Admin)' })
  @ApiResponse({ status: 201, description: 'User restricted', type: ModerationActionEntity })
  @HttpCode(HttpStatus.CREATED)
  async restrictUser(
    @CurrentUser('id') moderatorId: string,
    @Body()
    body: {
      userId: string;
      reason: string;
      expiresAt?: string;
      restrictions?: string[];
      buildingId?: string;
    },
  ): Promise<ModerationActionEntity> {
    return this.moderationService.restrictUser(
      moderatorId,
      body.userId,
      body.reason,
      body.expiresAt,
      body.restrictions,
      body.buildingId,
    );
  }

  @Post('suspend')
  @ApiOperation({ summary: 'Suspend a user (Admin)' })
  @ApiResponse({ status: 201, description: 'User suspended', type: ModerationActionEntity })
  @HttpCode(HttpStatus.CREATED)
  async suspendUser(
    @CurrentUser('id') moderatorId: string,
    @Body() body: { userId: string; reason: string; expiresAt: string; buildingId?: string },
  ): Promise<ModerationActionEntity> {
    return this.moderationService.suspendUser(
      moderatorId,
      body.userId,
      body.reason,
      body.expiresAt,
      body.buildingId,
    );
  }

  @Post('ban')
  @Roles('PLATFORM_ADMIN') // Ban is Platform Admin only
  @ApiOperation({ summary: 'Ban a user permanently (Platform Admin)' })
  @ApiResponse({ status: 201, description: 'User banned', type: ModerationActionEntity })
  @HttpCode(HttpStatus.CREATED)
  async banUser(
    @CurrentUser('id') moderatorId: string,
    @Body() body: { userId: string; reason: string },
  ): Promise<ModerationActionEntity> {
    return this.moderationService.banUser(moderatorId, body.userId, body.reason);
  }

  @Post('remove-content')
  @ApiOperation({ summary: 'Remove content (Admin)' })
  @ApiResponse({ status: 201, description: 'Content removed', type: ModerationActionEntity })
  @HttpCode(HttpStatus.CREATED)
  async removeContent(
    @CurrentUser('id') moderatorId: string,
    @Body()
    body: {
      entityType: string;
      entityId: string;
      reason: string;
      buildingId?: string;
    },
  ): Promise<ModerationActionEntity> {
    return this.moderationService.removeContent(
      moderatorId,
      body.entityType,
      body.entityId,
      body.reason,
      body.buildingId,
    );
  }

  @Get('actions')
  @ApiOperation({ summary: 'Get moderation actions (Admin)' })
  @ApiResponse({ status: 200, description: 'Returns moderation actions' })
  async getActions(@Query() query: GetModerationActionsDto) {
    return this.moderationService.getActions(query);
  }

  @Get('history/:targetType/:targetId')
  @ApiOperation({ summary: 'Get moderation history for a target (Admin)' })
  @ApiResponse({ status: 200, description: 'Returns moderation history' })
  async getHistory(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    return this.moderationService.getHistory(targetType, targetId);
  }

  @Patch('actions/:id/revoke')
  @ApiOperation({ summary: 'Revoke a moderation action (Admin)' })
  @ApiResponse({ status: 200, description: 'Moderation action revoked', type: ModerationActionEntity })
  async revokeAction(
    @Param('id') actionId: string,
    @CurrentUser('id') moderatorId: string,
    @Body() dto: RevokeModerationDto,
  ): Promise<ModerationActionEntity> {
    return this.moderationService.revokeAction(actionId, moderatorId, dto);
  }
}
