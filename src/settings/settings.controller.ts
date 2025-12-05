import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class UpdateSettingDto {
  value: any;
}

class UpdateManySettingsDto {
  settings: Record<string, any>;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public endpoint - get public settings only
  @Get('public')
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  // Admin only - get all settings
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAllSettings() {
    return this.settingsService.getAll();
  }

  // Admin only - get settings by category
  @Get('category/:category')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getByCategory(@Param('category') category: string) {
    return this.settingsService.getByCategory(category);
  }

  // Admin only - get all categories
  @Get('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getCategories() {
    return this.settingsService.getCategories();
  }

  // Admin only - update single setting
  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingsService.update(key, dto.value);
  }

  // Admin only - update multiple settings
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateManySettings(@Body() dto: UpdateManySettingsDto) {
    return this.settingsService.updateMany(dto.settings);
  }

  // Public endpoint - calculate delivery fee
  @Get('delivery-fee')
  async calculateDeliveryFee(
    @Query('distance') distance: string,
    @Query('total') total: string,
  ) {
    const distanceKm = parseFloat(distance) || 0;
    const orderTotal = parseFloat(total) || 0;
    const fee = await this.settingsService.calculateDeliveryFee(distanceKm, orderTotal);
    return { fee };
  }
}
