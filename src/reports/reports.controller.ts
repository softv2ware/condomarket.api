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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { GetReportsDto } from './dto/get-reports.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReportEntity } from './entities/report.entity';
import { JwtAuthGuard } from '~/auth/guards/jwt-auth.guard';
import { RolesGuard } from '~/auth/guards/roles.guard';
import { Roles } from '~/auth/decorators/roles.decorator';
import { CurrentUser } from '~/auth/decorators/current-user.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new report' })
  @ApiResponse({
    status: 201,
    description: 'Report created successfully',
    type: ReportEntity,
  })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') userId: string,
    @Body() createReportDto: CreateReportDto,
  ): Promise<ReportEntity> {
    return this.reportsService.create(userId, createReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my reports' })
  @ApiResponse({ status: 200, description: "Returns user's reports" })
  async getMyReports(
    @CurrentUser('id') userId: string,
    @Query() query: GetReportsDto,
  ) {
    return this.reportsService.getMyReports(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns report details',
    type: ReportEntity,
  })
  async getReport(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ): Promise<ReportEntity> {
    return this.reportsService.getReport(id, userId, userRole);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Get all reports (Admin)' })
  @ApiResponse({ status: 200, description: 'Returns all reports' })
  async getAllReports(@Query() query: GetReportsDto) {
    return this.reportsService.getAllReports(query);
  }

  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Get pending reports (Admin)' })
  @ApiResponse({ status: 200, description: 'Returns pending reports' })
  async getPendingReports() {
    return this.reportsService.getPendingReports();
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Review a report (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Report reviewed successfully',
    type: ReportEntity,
  })
  async reviewReport(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<ReportEntity> {
    return this.reportsService.reviewReport(id, userId, dto);
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Resolve a report (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Report resolved successfully',
    type: ReportEntity,
  })
  async resolveReport(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<ReportEntity> {
    return this.reportsService.resolveReport(id, userId, dto);
  }

  @Patch(':id/escalate')
  @UseGuards(RolesGuard)
  @Roles('BUILDING_ADMIN')
  @ApiOperation({ summary: 'Escalate report to Platform Admin' })
  @ApiResponse({
    status: 200,
    description: 'Report escalated successfully',
    type: ReportEntity,
  })
  async escalateReport(@Param('id') id: string): Promise<ReportEntity> {
    return this.reportsService.escalateReport(id);
  }

  @Patch(':id/dismiss')
  @UseGuards(RolesGuard)
  @Roles('PLATFORM_ADMIN', 'BUILDING_ADMIN')
  @ApiOperation({ summary: 'Dismiss a report (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Report dismissed successfully',
    type: ReportEntity,
  })
  async dismissReport(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewReportDto,
  ): Promise<ReportEntity> {
    return this.reportsService.dismissReport(id, userId, dto.resolution);
  }
}
