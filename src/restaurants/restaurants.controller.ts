import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { CreateMenuCategoryDto, UpdateMenuCategoryDto } from './dto/menu-category.dto';
import { UpdateRestaurantSettingsDto } from './dto/restaurant-settings.dto';

@ApiTags('restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get()
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.restaurantsService.findAll({
      categoryId,
      search,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('categories')
  async getCategories() {
    return this.restaurantsService.getCategories();
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.restaurantsService.findBySlug(slug);
  }

  @Get(':id/menu')
  async getMenu(@Param('id') id: string) {
    return this.restaurantsService.getMenu(id);
  }

  // ==================== RESTAURANT MANAGEMENT ====================

  @Get('my/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async getMyRestaurant(@CurrentUser('sub') userId: string) {
    return this.restaurantsService.getRestaurantByUserId(userId);
  }

  @Get('my/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get restaurant settings' })
  async getMySettings(@CurrentUser('sub') userId: string) {
    return this.restaurantsService.getRestaurantByUserId(userId);
  }

  @Patch('my/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async updateSettings(
    @CurrentUser('sub') userId: string,
    @Body() updateSettingsDto: UpdateRestaurantSettingsDto,
  ) {
    return this.restaurantsService.updateSettings(userId, updateSettingsDto);
  }

  @Patch('my/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async toggleOnlineStatus(@CurrentUser('sub') userId: string) {
    return this.restaurantsService.toggleOnlineStatus(userId);
  }

  // ==================== REPORTS ====================

  @Get('my/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  @ApiOperation({ summary: 'Get restaurant reports and statistics' })
  async getReports(
    @CurrentUser('sub') userId: string,
    @Query('period') period?: string,
  ) {
    return this.restaurantsService.getReports(userId, period || 'week');
  }

  // ==================== ORDERS MANAGEMENT ====================

  @Get('my/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async getMyOrders(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.restaurantsService.getRestaurantOrders(userId, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  // ==================== MENU CATEGORIES ====================

  @Get('my/menu-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async getMyMenuCategories(@CurrentUser('sub') userId: string) {
    return this.restaurantsService.getMenuCategories(userId);
  }

  @Post('my/menu-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async createMenuCategory(
    @CurrentUser('sub') userId: string,
    @Body() createDto: CreateMenuCategoryDto,
  ) {
    return this.restaurantsService.createMenuCategory(userId, createDto);
  }

  @Patch('my/menu-categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async updateMenuCategory(
    @CurrentUser('sub') userId: string,
    @Param('id') categoryId: string,
    @Body() updateDto: UpdateMenuCategoryDto,
  ) {
    return this.restaurantsService.updateMenuCategory(userId, categoryId, updateDto);
  }

  @Delete('my/menu-categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async deleteMenuCategory(
    @CurrentUser('sub') userId: string,
    @Param('id') categoryId: string,
  ) {
    return this.restaurantsService.deleteMenuCategory(userId, categoryId);
  }

  // ==================== MENU ITEMS ====================

  @Get('my/menu-items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async getMyMenuItems(
    @CurrentUser('sub') userId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.restaurantsService.getMenuItems(userId, categoryId);
  }

  @Post('my/menu-items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async createMenuItem(
    @CurrentUser('sub') userId: string,
    @Body() createDto: CreateMenuItemDto,
  ) {
    return this.restaurantsService.createMenuItem(userId, createDto);
  }

  @Patch('my/menu-items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async updateMenuItem(
    @CurrentUser('sub') userId: string,
    @Param('id') itemId: string,
    @Body() updateDto: UpdateMenuItemDto,
  ) {
    return this.restaurantsService.updateMenuItem(userId, itemId, updateDto);
  }

  @Patch('my/menu-items/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async toggleMenuItemAvailability(
    @CurrentUser('sub') userId: string,
    @Param('id') itemId: string,
  ) {
    return this.restaurantsService.toggleMenuItemAvailability(userId, itemId);
  }

  @Delete('my/menu-items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESTAURANT')
  async deleteMenuItem(
    @CurrentUser('sub') userId: string,
    @Param('id') itemId: string,
  ) {
    return this.restaurantsService.deleteMenuItem(userId, itemId);
  }
}
