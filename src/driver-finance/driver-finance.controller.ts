import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DriverFinanceService } from './driver-finance.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

@Controller('driver-finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriverFinanceController {
  constructor(
    private readonly driverFinanceService: DriverFinanceService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get earnings summary for authenticated driver
   */
  @Get('summary')
  @Roles('DRIVER')
  async getSummary(@Request() req: AuthenticatedRequest) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: req.user.sub },
    });

    if (!driver) {
      return { error: 'Driver not found' };
    }

    return this.driverFinanceService.getEarningsSummary(driver.id);
  }

  /**
   * Get earnings list for authenticated driver
   */
  @Get('earnings')
  @Roles('DRIVER')
  async getEarnings(
    @Request() req: AuthenticatedRequest,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: req.user.sub },
    });

    if (!driver) {
      return { error: 'Driver not found' };
    }

    return this.driverFinanceService.getEarnings(driver.id, {
      type: type as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /**
   * Get today's earnings for authenticated driver
   */
  @Get('today')
  @Roles('DRIVER')
  async getTodayEarnings(@Request() req: AuthenticatedRequest) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: req.user.sub },
    });

    if (!driver) {
      return { error: 'Driver not found' };
    }

    return this.driverFinanceService.getDailyEarnings(driver.id);
  }

  /**
   * Get daily earnings for a specific date
   */
  @Get('daily')
  @Roles('DRIVER')
  async getDailyEarnings(
    @Request() req: AuthenticatedRequest,
    @Query('date') dateStr?: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: req.user.sub },
    });

    if (!driver) {
      return { error: 'Driver not found' };
    }

    const date = dateStr ? new Date(dateStr) : new Date();
    return this.driverFinanceService.getDailyEarnings(driver.id, date);
  }
}

@Controller('admin/driver-finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDriverFinanceController {
  constructor(
    private readonly driverFinanceService: DriverFinanceService,
  ) {}

  /**
   * Get financial overview for all drivers
   */
  @Get('overview')
  async getOverview() {
    return this.driverFinanceService.getDriversFinancialOverview();
  }

  /**
   * Get top earning drivers
   */
  @Get('top-drivers')
  async getTopDrivers(@Query('limit') limit?: string) {
    return this.driverFinanceService.getTopDrivers(limit ? parseInt(limit) : 10);
  }
}
