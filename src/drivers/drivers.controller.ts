import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { UpdateLocationDto } from './dto/update-location.dto';

@ApiTags('drivers')
@ApiBearerAuth()
@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get('me')
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.driversService.getProfile(userId);
  }

  @Patch('status')
  async updateStatus(@CurrentUser('sub') userId: string, @Body('isOnline') isOnline: boolean) {
    return this.driversService.updateStatus(userId, isOnline);
  }

  @Patch('location')
  async updateLocation(
    @CurrentUser('sub') userId: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.driversService.updateLocation(
      userId,
      updateLocationDto.latitude,
      updateLocationDto.longitude,
    );
  }

  @Get('deliveries/available')
  async getAvailableDeliveries(@CurrentUser('sub') userId: string) {
    return this.driversService.getAvailableDeliveries(userId);
  }

  @Post('deliveries/:orderId/accept')
  async acceptDelivery(@CurrentUser('sub') userId: string, @Param('orderId') orderId: string) {
    return this.driversService.acceptDelivery(userId, orderId);
  }

  @Get('deliveries/current')
  async getCurrentDelivery(@CurrentUser('sub') userId: string) {
    return this.driversService.getCurrentDelivery(userId);
  }

  @Get('deliveries/history')
  async getDeliveryHistory(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.driversService.getDeliveryHistory(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('earnings')
  async getEarnings(
    @CurrentUser('sub') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.driversService.getEarnings(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
