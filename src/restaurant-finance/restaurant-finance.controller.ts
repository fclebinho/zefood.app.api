import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RestaurantFinanceService } from './restaurant-finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { EarningStatus, PayoutStatus, BankAccountType, PixKeyType } from '@prisma/client';

// ============================================
// DTOs
// ============================================

class EarningsQueryDto {
  @IsOptional()
  @IsEnum(EarningStatus)
  status?: EarningStatus;

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

class PayoutsQueryDto {
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

class RequestPayoutDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;
}

class ProcessPayoutDto {
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CancelPayoutDto {
  @IsString()
  reason: string;
}

class BankAccountDto {
  @IsString()
  holderName: string;

  @IsString()
  holderDocument: string;

  @IsString()
  bankCode: string;

  @IsString()
  bankName: string;

  @IsEnum(BankAccountType)
  accountType: BankAccountType;

  @IsString()
  agency: string;

  @IsOptional()
  @IsString()
  agencyDigit?: string;

  @IsString()
  accountNumber: string;

  @IsString()
  accountDigit: string;

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsEnum(PixKeyType)
  pixKeyType?: PixKeyType;
}

// ============================================
// Controller
// ============================================

// ============================================
// My Finance Controller (for authenticated restaurant users)
// ============================================

@ApiTags('restaurant-finance')
@Controller('restaurant-finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RESTAURANT')
@ApiBearerAuth()
export class MyFinanceController {
  constructor(
    private readonly financeService: RestaurantFinanceService,
    private readonly prisma: PrismaService,
  ) {}

  private async getRestaurantId(userId: string): Promise<string> {
    const restaurantUser = await this.prisma.restaurantUser.findFirst({
      where: { userId },
      select: { restaurantId: true },
    });
    if (!restaurantUser) {
      throw new NotFoundException('Restaurant not found for this user');
    }
    return restaurantUser.restaurantId;
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get earnings summary for my restaurant' })
  async getSummary(@CurrentUser('sub') userId: string) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.financeService.getEarningsSummary(restaurantId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get available balance for withdrawal' })
  async getBalance(@CurrentUser('sub') userId: string) {
    const restaurantId = await this.getRestaurantId(userId);
    const balance = await this.financeService.getAvailableBalance(restaurantId);
    return { availableBalance: balance };
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Get earnings history' })
  @ApiQuery({ name: 'status', enum: EarningStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getEarnings(
    @CurrentUser('sub') userId: string,
    @Query() query: EarningsQueryDto,
  ) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.financeService.getEarnings(restaurantId, query);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Get payouts history' })
  @ApiQuery({ name: 'status', enum: PayoutStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getPayouts(
    @CurrentUser('sub') userId: string,
    @Query() query: PayoutsQueryDto,
  ) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.financeService.getPayouts(restaurantId, query);
  }

  @Post('request-payout')
  @ApiOperation({ summary: 'Request a payout' })
  async requestPayout(
    @CurrentUser('sub') userId: string,
    @Body() dto: RequestPayoutDto,
  ) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.financeService.requestPayout(restaurantId, dto);
  }

  @Get('bank-account')
  @ApiOperation({ summary: 'Get bank account details' })
  async getBankAccount(@CurrentUser('sub') userId: string) {
    const restaurantId = await this.getRestaurantId(userId);
    const account = await this.financeService.getBankAccount(restaurantId);
    return account || null;
  }

  @Post('bank-account')
  @ApiOperation({ summary: 'Create or update bank account' })
  async upsertBankAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: BankAccountDto,
  ) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.financeService.upsertBankAccount(restaurantId, dto);
  }
}

// ============================================
// Restaurant Finance Controller (with restaurantId param)
// ============================================

@ApiTags('restaurant-finance')
@Controller('restaurants/:restaurantId/finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RestaurantFinanceController {
  constructor(private readonly financeService: RestaurantFinanceService) {}

  // ============================================
  // Earnings
  // ============================================

  @Get('summary')
  @ApiOperation({ summary: 'Get earnings summary for restaurant' })
  async getSummary(@Param('restaurantId') restaurantId: string) {
    return this.financeService.getEarningsSummary(restaurantId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get available balance for withdrawal' })
  async getBalance(@Param('restaurantId') restaurantId: string) {
    const balance = await this.financeService.getAvailableBalance(restaurantId);
    return { availableBalance: balance };
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Get earnings history' })
  @ApiQuery({ name: 'status', enum: EarningStatus, required: false })
  @ApiQuery({ name: 'startDate', type: Date, required: false })
  @ApiQuery({ name: 'endDate', type: Date, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getEarnings(
    @Param('restaurantId') restaurantId: string,
    @Query() query: EarningsQueryDto,
  ) {
    return this.financeService.getEarnings(restaurantId, query);
  }

  // ============================================
  // Payouts
  // ============================================

  @Get('payouts')
  @ApiOperation({ summary: 'Get payouts history' })
  @ApiQuery({ name: 'status', enum: PayoutStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getPayouts(
    @Param('restaurantId') restaurantId: string,
    @Query() query: PayoutsQueryDto,
  ) {
    return this.financeService.getPayouts(restaurantId, query);
  }

  @Post('payouts')
  @ApiOperation({ summary: 'Request a payout' })
  async requestPayout(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.financeService.requestPayout(restaurantId, dto);
  }

  // ============================================
  // Bank Account
  // ============================================

  @Get('bank-account')
  @ApiOperation({ summary: 'Get bank account details' })
  async getBankAccount(@Param('restaurantId') restaurantId: string) {
    const account = await this.financeService.getBankAccount(restaurantId);
    return account || { message: 'No bank account registered' };
  }

  @Put('bank-account')
  @ApiOperation({ summary: 'Create or update bank account' })
  async upsertBankAccount(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: BankAccountDto,
  ) {
    return this.financeService.upsertBankAccount(restaurantId, dto);
  }
}

// ============================================
// Admin Controller
// ============================================

@ApiTags('admin-finance')
@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminFinanceController {
  constructor(private readonly financeService: RestaurantFinanceService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get financial overview for all restaurants' })
  async getOverview() {
    return this.financeService.getFinancialOverview();
  }

  @Get('pending-payouts')
  @ApiOperation({ summary: 'Get all pending payouts' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getPendingPayouts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.financeService.getAllPendingPayouts(page, limit);
  }

  @Patch('payouts/:payoutId/process')
  @ApiOperation({ summary: 'Mark a payout as processed' })
  async processPayout(
    @Param('payoutId') payoutId: string,
    @Body() dto: ProcessPayoutDto,
    @Request() req: any,
  ) {
    await this.financeService.processPayout(payoutId, req.user.sub, dto);
    return { success: true, message: 'Payout marked as completed' };
  }

  @Patch('payouts/:payoutId/cancel')
  @ApiOperation({ summary: 'Cancel a pending payout' })
  async cancelPayout(
    @Param('payoutId') payoutId: string,
    @Body() dto: CancelPayoutDto,
  ) {
    await this.financeService.cancelPayout(payoutId, dto.reason);
    return { success: true, message: 'Payout cancelled' };
  }

  @Patch('bank-accounts/:restaurantId/verify')
  @ApiOperation({ summary: 'Verify a restaurant bank account' })
  async verifyBankAccount(@Param('restaurantId') restaurantId: string) {
    await this.financeService.verifyBankAccount(restaurantId);
    return { success: true, message: 'Bank account verified' };
  }

  @Post('update-pending-earnings')
  @ApiOperation({ summary: 'Update pending earnings to available (run manually)' })
  async updatePendingEarnings() {
    const count = await this.financeService.updatePendingEarnings();
    return { success: true, updatedCount: count };
  }
}
