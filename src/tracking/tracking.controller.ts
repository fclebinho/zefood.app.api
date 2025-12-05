import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class UpdateLocationDto {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

@Controller('tracking')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  // Driver updates their location
  @Post('location')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  async updateLocation(@Request() req: any, @Body() dto: UpdateLocationDto) {
    const driver = await this.getDriverFromUser(req.user.sub);
    return this.trackingService.updateDriverLocation(driver.id, dto);
  }

  // Get driver's current location
  @Get('driver/:driverId')
  async getDriverLocation(@Param('driverId') driverId: string) {
    return this.trackingService.getDriverLocation(driverId);
  }

  // Get order tracking info (for customer)
  @Get('order/:orderId')
  async getOrderTracking(@Param('orderId') orderId: string) {
    return this.trackingService.getOrderTracking(orderId);
  }

  // Get driver's active delivery
  @Get('active-delivery')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  async getActiveDelivery(@Request() req: any) {
    const driver = await this.getDriverFromUser(req.user.sub);
    return this.trackingService.getActiveDeliveryForDriver(driver.id);
  }

  private async getDriverFromUser(userId: string) {
    // This would normally be in a service
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const driver = await prisma.driver.findUnique({
      where: { userId },
    });
    await prisma.$disconnect();
    if (!driver) {
      throw new Error('Driver not found');
    }
    return driver;
  }
}
