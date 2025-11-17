import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { VerifyWithInvitationCodeDto } from './dto/verify-with-code.dto';
import { VerifyWithUnitDto } from './dto/verify-with-unit.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { GenerateInvitationCodeDto } from './dto/generate-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('verification')
@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('verify-with-code')
  @ApiOperation({ summary: 'Verify residence with invitation code' })
  @ApiResponse({ status: 201, description: 'Verification successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  verifyWithCode(
    @CurrentUser() user: any,
    @Body() dto: VerifyWithInvitationCodeDto,
  ) {
    return this.verificationService.verifyWithInvitationCode(user.id, dto);
  }

  @Post('verify-with-unit')
  @ApiOperation({ summary: 'Verify residence with unit number and last name' })
  @ApiResponse({ status: 201, description: 'Verification successful' })
  @ApiResponse({ status: 400, description: 'Invalid information' })
  verifyWithUnit(@CurrentUser() user: any, @Body() dto: VerifyWithUnitDto) {
    return this.verificationService.verifyWithUnit(user.id, dto);
  }

  @Post('request')
  @ApiOperation({ summary: 'Request manual verification approval' })
  @ApiResponse({ status: 201, description: 'Verification request submitted' })
  requestVerification(
    @CurrentUser() user: any,
    @Body() dto: RequestVerificationDto,
  ) {
    return this.verificationService.requestVerification(user.id, dto);
  }

  @Get('pending/:buildingId')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Get pending verification requests for a building' })
  @ApiResponse({ status: 200, description: 'List of pending verifications' })
  getPendingVerifications(@Param('buildingId') buildingId: string) {
    return this.verificationService.getPendingVerifications(buildingId);
  }

  @Patch(':id/review')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Approve or reject verification request' })
  @ApiResponse({ status: 200, description: 'Verification reviewed' })
  reviewVerification(
    @Param('id') verificationId: string,
    @CurrentUser() admin: any,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.reviewVerification(
      verificationId,
      admin.id,
      dto,
    );
  }

  @Post('invitation-codes')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Generate invitation code for a building' })
  @ApiResponse({ status: 201, description: 'Invitation code generated' })
  generateInvitationCode(
    @CurrentUser() admin: any,
    @Body() dto: GenerateInvitationCodeDto,
  ) {
    return this.verificationService.generateInvitationCode(admin.id, dto);
  }

  @Get('invitation-codes/:buildingId')
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Get all invitation codes for a building' })
  @ApiResponse({ status: 200, description: 'List of invitation codes' })
  getInvitationCodes(@Param('buildingId') buildingId: string) {
    return this.verificationService.getInvitationCodes(buildingId);
  }
}
