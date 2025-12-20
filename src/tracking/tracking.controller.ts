import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

class UpdateLocationDto {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

@ApiTags('tracking')
@ApiBearerAuth()
@Controller('tracking')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly prisma: PrismaService,
  ) {}

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
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    return driver;
  }
}
