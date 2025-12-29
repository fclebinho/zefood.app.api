import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EarningStatus, PayoutStatus, Prisma } from '@prisma/client';

export interface EarningsSummary {
  totalGross: number;
  totalPlatformFee: number;
  totalPaymentFee: number;
  totalNet: number;
  pendingAmount: number;
  availableAmount: number;
  paidOutAmount: number;
  earningsCount: number;
}

export interface PayoutRequestResult {
  success: boolean;
  payoutId?: string;
  amount?: number;
  error?: string;
}

@Injectable()
export class RestaurantFinanceService {
  private readonly logger = new Logger(RestaurantFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Create an earning record when an order is delivered/paid
   */
  async createEarning(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Check if earning already exists
    const existingEarning = await this.prisma.restaurantEarning.findUnique({
      where: { orderId },
    });

    if (existingEarning) {
      this.logger.debug(`Earning already exists for order ${orderId}`);
      return;
    }

    // Get fee percentages from settings
    const platformFeePercentage = await this.settingsService.get<number>('platform_fee_percentage') ?? 15;
    const paymentFeePercentage = await this.settingsService.get<number>('payment_fee_percentage') ?? 3.5;
    const earningDelayDays = await this.settingsService.get<number>('earning_delay_days') ?? 3;

    // Calculate amounts
    const grossAmount = Number(order.subtotal); // Use subtotal (without delivery fee)
    const platformFee = grossAmount * (platformFeePercentage / 100);
    const paymentFee = grossAmount * (paymentFeePercentage / 100);
    const netAmount = grossAmount - platformFee - paymentFee;

    // Calculate when the earning becomes available
    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + earningDelayDays);

    await this.prisma.restaurantEarning.create({
      data: {
        restaurantId: order.restaurantId,
        orderId: order.id,
        grossAmount,
        platformFee,
        paymentFee,
        netAmount,
        feePercentage: platformFeePercentage,
        availableAt,
        status: 'PENDING',
      },
    });

    this.logger.log(`Created earning for order ${orderId}: gross=${grossAmount}, net=${netAmount}`);
  }

  /**
   * Update pending earnings to available status
   * Should be run periodically (e.g., via cron job)
   */
  async updatePendingEarnings(): Promise<number> {
    const result = await this.prisma.restaurantEarning.updateMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      data: {
        status: 'AVAILABLE',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Updated ${result.count} earnings from PENDING to AVAILABLE`);
    }

    return result.count;
  }

  /**
   * Get earnings summary for a restaurant
   */
  async getEarningsSummary(restaurantId: string): Promise<EarningsSummary> {
    const earnings = await this.prisma.restaurantEarning.findMany({
      where: { restaurantId },
    });

    const summary: EarningsSummary = {
      totalGross: 0,
      totalPlatformFee: 0,
      totalPaymentFee: 0,
      totalNet: 0,
      pendingAmount: 0,
      availableAmount: 0,
      paidOutAmount: 0,
      earningsCount: earnings.length,
    };

    for (const earning of earnings) {
      summary.totalGross += Number(earning.grossAmount);
      summary.totalPlatformFee += Number(earning.platformFee);
      summary.totalPaymentFee += Number(earning.paymentFee);
      summary.totalNet += Number(earning.netAmount);

      switch (earning.status) {
        case 'PENDING':
          summary.pendingAmount += Number(earning.netAmount);
          break;
        case 'AVAILABLE':
          summary.availableAmount += Number(earning.netAmount);
          break;
        case 'PAID_OUT':
          summary.paidOutAmount += Number(earning.netAmount);
          break;
      }
    }

    return summary;
  }

  /**
   * Get earnings list for a restaurant
   */
  async getEarnings(
    restaurantId: string,
    options: {
      status?: EarningStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, startDate, endDate, page = 1, limit = 20 } = options;

    const where: Prisma.RestaurantEarningWhereInput = {
      restaurantId,
      ...(status && { status }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
    };

    const [earnings, total] = await Promise.all([
      this.prisma.restaurantEarning.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              total: true,
              createdAt: true,
              paymentMethod: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.restaurantEarning.count({ where }),
    ]);

    // Convert Decimal fields to numbers for JSON serialization
    const serializedEarnings = earnings.map((earning) => ({
      ...earning,
      grossAmount: Number(earning.grossAmount),
      platformFee: Number(earning.platformFee),
      paymentFee: Number(earning.paymentFee),
      netAmount: Number(earning.netAmount),
      feePercentage: Number(earning.feePercentage),
      order: earning.order ? {
        ...earning.order,
        total: Number(earning.order.total),
      } : null,
    }));

    return {
      data: serializedEarnings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get available balance for withdrawal
   */
  async getAvailableBalance(restaurantId: string): Promise<number> {
    // First, update any pending earnings that should now be available
    await this.updatePendingEarnings();

    const result = await this.prisma.restaurantEarning.aggregate({
      where: {
        restaurantId,
        status: 'AVAILABLE',
      },
      _sum: {
        netAmount: true,
      },
    });

    return Number(result._sum.netAmount ?? 0);
  }

  /**
   * Request a payout
   */
  async requestPayout(
    restaurantId: string,
    options: {
      amount?: number; // If not specified, withdraw all available
    } = {},
  ): Promise<PayoutRequestResult> {
    // Get available balance
    const availableBalance = await this.getAvailableBalance(restaurantId);

    // Get minimum payout amount from settings
    const minPayoutAmount = await this.settingsService.get<number>('min_payout_amount') ?? 50;

    if (availableBalance < minPayoutAmount) {
      return {
        success: false,
        error: `Saldo mínimo para saque é R$ ${minPayoutAmount.toFixed(2)}. Saldo disponível: R$ ${availableBalance.toFixed(2)}`,
      };
    }

    const amount = options.amount ?? availableBalance;

    if (amount > availableBalance) {
      return {
        success: false,
        error: `Valor solicitado (R$ ${amount.toFixed(2)}) é maior que o saldo disponível (R$ ${availableBalance.toFixed(2)})`,
      };
    }

    if (amount < minPayoutAmount) {
      return {
        success: false,
        error: `Valor mínimo para saque é R$ ${minPayoutAmount.toFixed(2)}`,
      };
    }

    // Check if restaurant has bank account
    const bankAccount = await this.prisma.restaurantBankAccount.findUnique({
      where: { restaurantId },
    });

    if (!bankAccount) {
      return {
        success: false,
        error: 'Conta bancária não cadastrada. Configure seus dados bancários primeiro.',
      };
    }

    // Get available earnings to include in payout
    const availableEarnings = await this.prisma.restaurantEarning.findMany({
      where: {
        restaurantId,
        status: 'AVAILABLE',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate which earnings will be included
    let runningTotal = 0;
    const earningsToInclude: string[] = [];
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    for (const earning of availableEarnings) {
      const earningAmount = Number(earning.netAmount);
      if (runningTotal + earningAmount <= amount) {
        runningTotal += earningAmount;
        earningsToInclude.push(earning.id);
        if (!periodStart || earning.createdAt < periodStart) {
          periodStart = earning.createdAt;
        }
        if (!periodEnd || earning.createdAt > periodEnd) {
          periodEnd = earning.createdAt;
        }
      }
    }

    if (earningsToInclude.length === 0) {
      return {
        success: false,
        error: 'Nenhum ganho disponível para saque',
      };
    }

    // Create payout and update earnings in a transaction
    const payout = await this.prisma.$transaction(async (tx) => {
      // Create the payout
      const newPayout = await tx.restaurantPayout.create({
        data: {
          restaurantId,
          amount: runningTotal,
          status: 'PENDING',
          payoutMethod: bankAccount.pixKey ? 'PIX' : 'TED',
          periodStart: periodStart!,
          periodEnd: periodEnd!,
          earningsCount: earningsToInclude.length,
        },
      });

      // Update earnings to PAID_OUT status
      await tx.restaurantEarning.updateMany({
        where: {
          id: { in: earningsToInclude },
        },
        data: {
          status: 'PAID_OUT',
        },
      });

      return newPayout;
    });

    this.logger.log(`Created payout ${payout.id} for restaurant ${restaurantId}: R$ ${runningTotal.toFixed(2)}`);

    return {
      success: true,
      payoutId: payout.id,
      amount: runningTotal,
    };
  }

  /**
   * Get payouts history for a restaurant
   */
  async getPayouts(
    restaurantId: string,
    options: {
      status?: PayoutStatus;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, page = 1, limit = 20 } = options;

    const where: Prisma.RestaurantPayoutWhereInput = {
      restaurantId,
      ...(status && { status }),
    };

    const [payouts, total] = await Promise.all([
      this.prisma.restaurantPayout.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.restaurantPayout.count({ where }),
    ]);

    // Convert Decimal fields to numbers for JSON serialization
    const serializedPayouts = payouts.map((payout) => ({
      ...payout,
      amount: Number(payout.amount),
    }));

    return {
      data: serializedPayouts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Process a payout (admin only)
   */
  async processPayout(
    payoutId: string,
    adminUserId: string,
    data: {
      reference?: string;
      receiptUrl?: string;
      notes?: string;
    },
  ): Promise<void> {
    const payout = await this.prisma.restaurantPayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException(`Payout already processed (status: ${payout.status})`);
    }

    await this.prisma.restaurantPayout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        processedBy: adminUserId,
        reference: data.reference,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
      },
    });

    this.logger.log(`Payout ${payoutId} marked as completed by admin ${adminUserId}`);
  }

  /**
   * Cancel a pending payout
   */
  async cancelPayout(payoutId: string, reason: string): Promise<void> {
    const payout = await this.prisma.restaurantPayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException(`Cannot cancel payout with status: ${payout.status}`);
    }

    // Revert earnings back to AVAILABLE
    await this.prisma.$transaction(async (tx) => {
      // Find earnings that were part of this payout period
      await tx.restaurantEarning.updateMany({
        where: {
          restaurantId: payout.restaurantId,
          status: 'PAID_OUT',
          createdAt: {
            gte: payout.periodStart,
            lte: payout.periodEnd,
          },
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      // Update payout status
      await tx.restaurantPayout.update({
        where: { id: payoutId },
        data: {
          status: 'FAILED',
          notes: reason,
        },
      });
    });

    this.logger.log(`Payout ${payoutId} cancelled: ${reason}`);
  }

  // ============================================
  // Bank Account Management
  // ============================================

  /**
   * Get bank account for a restaurant
   */
  async getBankAccount(restaurantId: string) {
    return this.prisma.restaurantBankAccount.findUnique({
      where: { restaurantId },
    });
  }

  /**
   * Create or update bank account
   */
  async upsertBankAccount(
    restaurantId: string,
    data: {
      holderName: string;
      holderDocument: string;
      bankCode: string;
      bankName: string;
      accountType: 'CHECKING' | 'SAVINGS';
      agency: string;
      agencyDigit?: string;
      accountNumber: string;
      accountDigit: string;
      pixKey?: string;
      pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';
    },
  ) {
    return this.prisma.restaurantBankAccount.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        ...data,
      },
      update: {
        ...data,
        isVerified: false, // Reset verification when data changes
        verifiedAt: null,
      },
    });
  }

  /**
   * Verify bank account (admin only)
   */
  async verifyBankAccount(restaurantId: string): Promise<void> {
    await this.prisma.restaurantBankAccount.update({
      where: { restaurantId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
  }

  // ============================================
  // Admin Methods
  // ============================================

  /**
   * Get all pending payouts (admin)
   */
  async getAllPendingPayouts(page = 1, limit = 20) {
    const [payouts, total] = await Promise.all([
      this.prisma.restaurantPayout.findMany({
        where: { status: 'PENDING' },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { requestedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.restaurantPayout.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      data: payouts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get financial overview for all restaurants (admin)
   */
  async getFinancialOverview() {
    const [totalEarnings, pendingPayouts, completedPayouts] = await Promise.all([
      this.prisma.restaurantEarning.aggregate({
        _sum: {
          grossAmount: true,
          platformFee: true,
          paymentFee: true,
          netAmount: true,
        },
      }),
      this.prisma.restaurantPayout.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.restaurantPayout.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalGrossRevenue: Number(totalEarnings._sum.grossAmount ?? 0),
      totalPlatformFees: Number(totalEarnings._sum.platformFee ?? 0),
      totalPaymentFees: Number(totalEarnings._sum.paymentFee ?? 0),
      totalNetToRestaurants: Number(totalEarnings._sum.netAmount ?? 0),
      pendingPayouts: {
        count: pendingPayouts._count,
        amount: Number(pendingPayouts._sum.amount ?? 0),
      },
      completedPayouts: {
        count: completedPayouts._count,
        amount: Number(completedPayouts._sum.amount ?? 0),
      },
    };
  }
}
