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
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Transaction } from './entities/transaction.entity';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Record a transaction for an order or booking',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction recorded successfully',
    type: Transaction,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order or booking not found' })
  create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.transactionsService.create(createTransactionDto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: [Transaction],
  })
  findAll(@CurrentUser() user: { userId: string }) {
    return this.transactionsService.findAll(user.userId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiQuery({
    name: 'role',
    required: true,
    enum: ['buyer', 'seller'],
    description: 'Calculate statistics as buyer or seller',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  getStatistics(
    @Query('role') role: 'buyer' | 'seller',
    @CurrentUser() user: { userId: string },
  ) {
    return this.transactionsService.getStatistics(user.userId, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific transaction' })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
    type: Transaction,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.transactionsService.findOne(id, user.userId);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Mark transaction as paid' })
  @ApiResponse({
    status: 200,
    description: 'Transaction marked as paid',
    type: Transaction,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  markAsPaid(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.transactionsService.markAsPaid(id, user.userId);
  }

  @Patch(':id/mark-failed')
  @ApiOperation({ summary: 'Mark transaction as failed' })
  @ApiResponse({
    status: 200,
    description: 'Transaction marked as failed',
    type: Transaction,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  markAsFailed(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: { userId: string },
  ) {
    return this.transactionsService.markAsFailed(id, user.userId, reason);
  }
}
