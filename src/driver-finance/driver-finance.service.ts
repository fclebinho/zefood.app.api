import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EarningType, Prisma } from '@prisma/client';

export interface DriverEarningsSummary {
  totalEarnings: number;
  totalDeliveries: number;
  totalBonuses: number;
  totalTips: number;
  pendingBalance: number;
  paidOutAmount: number;
  averagePerDelivery: number;
}

@Injectable()
export class DriverFinanceService {
  private readonly logger = new Logger(DriverFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Create driver earning when an order is delivered
   * Called after the order status changes to DELIVERED
   */
  async createDeliveryEarning(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { driver: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (!order.driverId) {
      this.logger.debug(`Order ${orderId} has no driver assigned, skipping driver earning`);
      return;
    }

    // Check if earning already exists for this order
    const existingEarning = await this.prisma.driverEarning.findUnique({
      where: { orderId },
    });

    if (existingEarning) {
      this.logger.debug(`Driver earning already exists for order ${orderId}`);
      return;
    }

    // Get driver commission percentage from settings (default 80% of delivery fee)
    const driverCommissionPercentage = await this.settingsService.get<number>('driver_commission_percentage') ?? 80;

    // Calculate driver earning from delivery fee
    const deliveryFee = Number(order.deliveryFee);
    const driverEarning = deliveryFee * (driverCommissionPercentage / 100);
    const platformDeliveryFee = deliveryFee - driverEarning;

    await this.prisma.driverEarning.create({
      data: {
        driverId: order.driverId,
        orderId: order.id,
        amount: driverEarning,
        type: 'DELIVERY',
        description: `Entrega do pedido #${order.orderNumber}`,
      },
    });

    this.logger.log(
      `Created driver earning for order ${orderId}: driver=${order.driverId}, ` +
      `deliveryFee=${deliveryFee}, driverEarning=${driverEarning}, platformFee=${platformDeliveryFee}`
    );
  }

  /**
   * Add bonus earning for a driver (e.g., completion bonus, peak hours bonus)
   */
  async addBonusEarning(
    driverId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    await this.prisma.driverEarning.create({
      data: {
        driverId,
        amount,
        type: 'BONUS',
        description,
      },
    });

    this.logger.log(`Added bonus earning for driver ${driverId}: ${amount} - ${description}`);
  }

  /**
   * Add tip earning for a driver
   */
  async addTipEarning(
    driverId: string,
    orderId: string,
    amount: number,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    await this.prisma.driverEarning.create({
      data: {
        driverId,
        amount,
        type: 'TIP',
        description: order ? `Gorjeta do pedido #${order.orderNumber}` : 'Gorjeta',
      },
    });

    this.logger.log(`Added tip earning for driver ${driverId}: ${amount}`);
  }

  /**
   * Get earnings summary for a driver
   */
  async getEarningsSummary(driverId: string): Promise<DriverEarningsSummary> {
    const earnings = await this.prisma.driverEarning.findMany({
      where: { driverId },
    });

    const summary: DriverEarningsSummary = {
      totalEarnings: 0,
      totalDeliveries: 0,
      totalBonuses: 0,
      totalTips: 0,
      pendingBalance: 0,
      paidOutAmount: 0,
      averagePerDelivery: 0,
    };

    let deliveryCount = 0;
    let deliveryTotal = 0;

    for (const earning of earnings) {
      const amount = Number(earning.amount);
      summary.totalEarnings += amount;

      switch (earning.type) {
        case 'DELIVERY':
          deliveryCount++;
          deliveryTotal += amount;
          summary.totalDeliveries++;
          break;
        case 'BONUS':
          summary.totalBonuses += amount;
          break;
        case 'TIP':
          summary.totalTips += amount;
          break;
      }
    }

    // For now, all earnings are considered pending (no payout system for drivers yet)
    summary.pendingBalance = summary.totalEarnings;
    summary.averagePerDelivery = deliveryCount > 0 ? deliveryTotal / deliveryCount : 0;

    return summary;
  }

  /**
   * Get earnings list for a driver
   */
  async getEarnings(
    driverId: string,
    options: {
      type?: EarningType;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { type, startDate, endDate, page = 1, limit = 20 } = options;

    const where: Prisma.DriverEarningWhereInput = {
      driverId,
      ...(type && { type }),
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const [earnings, total] = await Promise.all([
      this.prisma.driverEarning.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              deliveryFee: true,
              createdAt: true,
              restaurant: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driverEarning.count({ where }),
    ]);

    return {
      data: earnings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get daily earnings for a driver (for dashboard)
   */
  async getDailyEarnings(driverId: string, date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const earnings = await this.prisma.driverEarning.findMany({
      where: {
        driverId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            restaurant: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = earnings.reduce((sum, e) => sum + Number(e.amount), 0);
    const deliveryCount = earnings.filter(e => e.type === 'DELIVERY').length;

    return {
      date: date.toISOString().split('T')[0],
      earnings,
      summary: {
        total,
        deliveryCount,
        averagePerDelivery: deliveryCount > 0 ? total / deliveryCount : 0,
      },
    };
  }

  // ============================================
  // Admin Methods
  // ============================================

  /**
   * Get financial overview for all drivers (admin)
   */
  async getDriversFinancialOverview() {
    const [totalEarnings, earningsByType] = await Promise.all([
      this.prisma.driverEarning.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.driverEarning.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const byType: Record<string, { count: number; amount: number }> = {};
    for (const item of earningsByType) {
      byType[item.type] = {
        count: item._count,
        amount: Number(item._sum.amount ?? 0),
      };
    }

    return {
      totalEarnings: Number(totalEarnings._sum.amount ?? 0),
      totalTransactions: totalEarnings._count,
      byType,
    };
  }

  /**
   * Get top earning drivers (admin)
   */
  async getTopDrivers(limit = 10) {
    const topDrivers = await this.prisma.driverEarning.groupBy({
      by: ['driverId'],
      _sum: { amount: true },
      _count: true,
      orderBy: {
        _sum: { amount: 'desc' },
      },
      take: limit,
    });

    const driverIds = topDrivers.map(d => d.driverId);
    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: {
        id: true,
        fullName: true,
      },
    });

    const driversMap = new Map(drivers.map(d => [d.id, d]));

    return topDrivers.map(item => ({
      driver: driversMap.get(item.driverId),
      totalEarnings: Number(item._sum.amount ?? 0),
      deliveryCount: item._count,
    }));
  }

  /**
   * Backfill earnings for delivered orders that don't have driver earnings yet
   * This is used to migrate historical data
   */
  async backfillEarnings(): Promise<{ processed: number; created: number; skipped: number }> {
    // Get driver commission percentage from settings (default 80% of delivery fee)
    const driverCommissionPercentage = await this.settingsService.get<number>('driver_commission_percentage') ?? 80;

    // Find all delivered orders with a driver that don't have a driver earning
    const ordersWithoutEarnings = await this.prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        driverId: { not: null },
        driverEarning: null,
      },
      select: {
        id: true,
        orderNumber: true,
        driverId: true,
        deliveryFee: true,
      },
    });

    let created = 0;
    let skipped = 0;

    for (const order of ordersWithoutEarnings) {
      if (!order.driverId) {
        skipped++;
        continue;
      }

      const deliveryFee = Number(order.deliveryFee);
      const driverEarning = deliveryFee * (driverCommissionPercentage / 100);

      try {
        await this.prisma.driverEarning.create({
          data: {
            driverId: order.driverId,
            orderId: order.id,
            amount: driverEarning,
            type: 'DELIVERY',
            description: `Entrega do pedido #${order.orderNumber}`,
          },
        });
        created++;
        this.logger.log(`Created driver earning for historical order ${order.id}`);
      } catch (error) {
        // Skip if already exists (race condition)
        skipped++;
      }
    }

    this.logger.log(`Backfill complete: processed=${ordersWithoutEarnings.length}, created=${created}, skipped=${skipped}`);

    return {
      processed: ordersWithoutEarnings.length,
      created,
      skipped,
    };
  }
}
