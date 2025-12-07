import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { RestaurantStatus, OrderStatus } from '@prisma/client';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { CreateMenuCategoryDto, UpdateMenuCategoryDto } from './dto/menu-category.dto';
import { UpdateRestaurantSettingsDto } from './dto/restaurant-settings.dto';

@Injectable()
export class RestaurantsService {
  constructor(
    private prisma: PrismaService,
    private geocodingService: GeocodingService,
  ) {}

  async findAll(query: {
    categoryId?: string;
    search?: string;
    latitude?: number;
    longitude?: number;
    page?: number;
    limit?: number;
  }) {
    const { categoryId, search, page = 1, limit = 20 } = query;

    const where = {
      status: RestaurantStatus.ACTIVE,
      isOpen: true,
      ...(categoryId && {
        categories: {
          some: { categoryId },
        },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        include: {
          categories: {
            include: {
              category: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { rating: 'desc' },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      data: restaurants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        hours: true,
        menuCategories: {
          include: {
            items: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return restaurant;
  }

  async findById(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        hours: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return restaurant;
  }

  async getMenu(restaurantId: string) {
    const menuCategories = await this.prisma.menuCategory.findMany({
      where: {
        restaurantId,
        isActive: true,
      },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return menuCategories;
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ==================== RESTAURANT MANAGEMENT ====================

  private async getRestaurantIdByUserId(userId: string): Promise<string> {
    const restaurantUser = await this.prisma.restaurantUser.findFirst({
      where: { userId },
      select: { restaurantId: true },
    });

    if (!restaurantUser) {
      throw new NotFoundException('Restaurant not found for this user');
    }

    return restaurantUser.restaurantId;
  }

  async getRestaurantByUserId(userId: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    return this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        hours: true,
        categories: {
          include: { category: true },
        },
      },
    });
  }

  async updateSettings(userId: string, dto: UpdateRestaurantSettingsDto) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const { openingHours, ...restaurantData } = dto;

    const updateData: Record<string, unknown> = {};

    if (restaurantData.name) updateData.name = restaurantData.name;
    if (restaurantData.description !== undefined) updateData.description = restaurantData.description;
    if (restaurantData.phone !== undefined) updateData.phone = restaurantData.phone;
    if (restaurantData.email !== undefined) updateData.email = restaurantData.email;
    if (restaurantData.street) updateData.street = restaurantData.street;
    if (restaurantData.number) updateData.number = restaurantData.number;
    if (restaurantData.complement !== undefined) updateData.complement = restaurantData.complement;
    if (restaurantData.neighborhood) updateData.neighborhood = restaurantData.neighborhood;
    if (restaurantData.city) updateData.city = restaurantData.city;
    if (restaurantData.state) updateData.state = restaurantData.state;
    if (restaurantData.zipCode) updateData.zipCode = restaurantData.zipCode;
    if (restaurantData.deliveryFee !== undefined) updateData.deliveryFee = restaurantData.deliveryFee;
    if (restaurantData.minOrderValue !== undefined) updateData.minOrderValue = restaurantData.minOrderValue;
    if (restaurantData.avgPrepTime !== undefined) updateData.avgPrepTime = restaurantData.avgPrepTime;
    if (restaurantData.deliveryRadius !== undefined) updateData.deliveryRadius = restaurantData.deliveryRadius;
    if (restaurantData.isOpen !== undefined) updateData.isOpen = restaurantData.isOpen;

    if (openingHours && openingHours.length > 0) {
      for (const hour of openingHours) {
        await this.prisma.restaurantHour.upsert({
          where: {
            restaurantId_dayOfWeek: {
              restaurantId,
              dayOfWeek: hour.dayOfWeek,
            },
          },
          update: {
            openTime: hour.openTime ? new Date(`1970-01-01T${hour.openTime}:00`) : null,
            closeTime: hour.closeTime ? new Date(`1970-01-01T${hour.closeTime}:00`) : null,
            isClosed: hour.isClosed ?? false,
          },
          create: {
            restaurantId,
            dayOfWeek: hour.dayOfWeek,
            openTime: hour.openTime ? new Date(`1970-01-01T${hour.openTime}:00`) : null,
            closeTime: hour.closeTime ? new Date(`1970-01-01T${hour.closeTime}:00`) : null,
            isClosed: hour.isClosed ?? false,
          },
        });
      }
    }

    const updatedRestaurant = await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: updateData,
      include: {
        hours: true,
      },
    });

    // Geocode restaurant address asynchronously if zipCode was updated
    if (restaurantData.zipCode) {
      this.geocodingService.geocodeRestaurantAsync(restaurantId, restaurantData.zipCode);
    }

    return updatedRestaurant;
  }

  async toggleOnlineStatus(userId: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isOpen: !restaurant.isOpen },
    });
  }

  // ==================== ORDERS MANAGEMENT ====================

  async getRestaurantOrders(
    userId: string,
    query: { status?: string; page: number; limit: number },
  ) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);
    const { status, page, limit } = query;

    const where: Record<string, unknown> = { restaurantId };

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              fullName: true,
              user: {
                select: {
                  phone: true,
                },
              },
            },
          },
          items: {
            include: {
              menuItem: {
                select: {
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      ...order,
      customer: {
        fullName: order.customer?.fullName || 'Cliente',
        phone: order.customer?.user?.phone,
      },
    }));

    return formattedOrders;
  }

  // ==================== MENU CATEGORIES ====================

  async getMenuCategories(userId: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    return this.prisma.menuCategory.findMany({
      where: { restaurantId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createMenuCategory(userId: string, dto: CreateMenuCategoryDto) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const maxSortOrder = await this.prisma.menuCategory.aggregate({
      where: { restaurantId },
      _max: { sortOrder: true },
    });

    return this.prisma.menuCategory.create({
      data: {
        restaurantId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? 0) + 1,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateMenuCategory(
    userId: string,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
  ) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const category = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: dto,
    });
  }

  async deleteMenuCategory(userId: string, categoryId: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const category = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.menuCategory.delete({
      where: { id: categoryId },
    });

    return { success: true };
  }

  // ==================== MENU ITEMS ====================

  async getMenuItems(userId: string, categoryId?: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const where: Record<string, unknown> = {
      category: { restaurantId },
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    return this.prisma.menuItem.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createMenuItem(userId: string, dto: CreateMenuItemDto) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const category = await this.prisma.menuCategory.findFirst({
      where: { id: dto.categoryId, restaurantId },
    });

    if (!category) {
      throw new ForbiddenException('Category does not belong to your restaurant');
    }

    const maxSortOrder = await this.prisma.menuItem.aggregate({
      where: { categoryId: dto.categoryId },
      _max: { sortOrder: true },
    });

    return this.prisma.menuItem.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        isAvailable: dto.isAvailable ?? true,
        sortOrder: dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? 0) + 1,
        prepTime: dto.prepTime,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateMenuItem(userId: string, itemId: string, dto: UpdateMenuItemDto) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        category: { restaurantId },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.menuCategory.findFirst({
        where: { id: dto.categoryId, restaurantId },
      });

      if (!category) {
        throw new ForbiddenException('Category does not belong to your restaurant');
      }
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: dto,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async toggleMenuItemAvailability(userId: string, itemId: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        category: { restaurantId },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: !item.isAvailable },
    });
  }

  async deleteMenuItem(userId: string, itemId: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        category: { restaurantId },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    await this.prisma.menuItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  }

  // ==================== REPORTS ====================

  async getReports(userId: string, period: string) {
    const restaurantId = await this.getRestaurantIdByUserId(userId);

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get current period stats
    const [totalRevenue, totalOrders, uniqueCustomers] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          restaurantId,
          createdAt: { gte: startDate },
          status: { notIn: [OrderStatus.CANCELLED] },
        },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: {
          restaurantId,
          createdAt: { gte: startDate },
          status: { notIn: [OrderStatus.CANCELLED] },
        },
      }),
      this.prisma.order.findMany({
        where: {
          restaurantId,
          createdAt: { gte: startDate },
          status: { notIn: [OrderStatus.CANCELLED] },
        },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
    ]);

    const revenue = Number(totalRevenue._sum?.total) || 0;
    const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;

    // Get top products
    const topProducts = await this.prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        order: {
          restaurantId,
          createdAt: { gte: startDate },
          status: { notIn: [OrderStatus.CANCELLED] },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 5,
    });

    // Get menu item names
    const menuItemIds = topProducts.map((p) => p.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m.name]));
    const totalProductRevenue = topProducts.reduce(
      (sum, p) => sum + (Number(p._sum?.totalPrice) || 0),
      0,
    );

    const formattedTopProducts = topProducts.map((p) => ({
      name: menuItemMap.get(p.menuItemId) || 'Produto Desconhecido',
      quantity: p._sum?.quantity || 0,
      revenue: Number(p._sum?.totalPrice) || 0,
      percent:
        totalProductRevenue > 0
          ? Math.round(((Number(p._sum?.totalPrice) || 0) / totalProductRevenue) * 100)
          : 0,
    }));

    // Get revenue by day (last 7 days)
    const revenueByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayRevenue = await this.prisma.order.aggregate({
        where: {
          restaurantId,
          createdAt: { gte: dayStart, lte: dayEnd },
          status: { notIn: [OrderStatus.CANCELLED] },
        },
        _sum: { total: true },
        _count: true,
      });

      revenueByDay.push({
        date: dayStart.toISOString().split('T')[0],
        dayOfWeek: dayStart.toLocaleDateString('pt-BR', { weekday: 'short' }),
        revenue: Number(dayRevenue._sum?.total) || 0,
        orders: dayRevenue._count,
      });
    }

    // Get orders by hour (for today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const ordersByHour = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        restaurantId,
        createdAt: { gte: todayStart },
        status: { notIn: [OrderStatus.CANCELLED] },
      },
      _count: true,
    });

    // Aggregate by hour
    const hourlyData: { [key: number]: number } = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = 0;
    }
    ordersByHour.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      hourlyData[hour] += o._count;
    });

    const formattedOrdersByHour = Object.entries(hourlyData).map(([hour, count]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      orders: count,
    }));

    return {
      stats: {
        totalRevenue: revenue,
        totalOrders,
        avgTicket,
        uniqueCustomers: uniqueCustomers.length,
      },
      topProducts: formattedTopProducts,
      revenueByDay,
      ordersByHour: formattedOrdersByHour,
    };
  }
}
