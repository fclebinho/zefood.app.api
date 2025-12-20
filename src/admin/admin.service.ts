import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantStatus, DriverStatus, OrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // Dashboard Metrics
  async getDashboardMetrics() {
    const [
      totalUsers,
      totalRestaurants,
      totalDrivers,
      totalOrders,
      pendingRestaurants,
      activeDrivers,
      todayOrders,
      todayRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.restaurant.count(),
      this.prisma.driver.count(),
      this.prisma.order.count(),
      this.prisma.restaurant.count({ where: { status: RestaurantStatus.PENDING } }),
      this.prisma.driver.count({ where: { isOnline: true } }),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          status: OrderStatus.DELIVERED,
        },
        _sum: { total: true },
      }),
    ]);

    return {
      totalUsers,
      totalRestaurants,
      totalDrivers,
      totalOrders,
      pendingRestaurants,
      activeDrivers,
      todayOrders,
      todayRevenue: todayRevenue._sum?.total || 0,
    };
  }

  // Orders by status for chart
  async getOrdersByStatus() {
    const orders = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    return orders.map((o) => ({
      status: o.status,
      count: o._count.status,
    }));
  }

  // Revenue by day (last 7 days)
  async getRevenueByDay() {
    const days = 7;
    const results = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const revenue = await this.prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: OrderStatus.DELIVERED,
        },
        _sum: { total: true },
        _count: true,
      });

      results.push({
        date: startOfDay.toISOString().split('T')[0],
        revenue: revenue._sum?.total || 0,
        orders: revenue._count,
      });
    }

    return results.reverse();
  }

  // Restaurant Management
  async getRestaurants(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status as RestaurantStatus;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        include: {
          users: {
            where: { role: 'OWNER' },
            include: { user: { select: { id: true, email: true } } },
            take: 1,
          },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    // Transform data to match expected format
    const transformedRestaurants = restaurants.map((r) => ({
      ...r,
      owner: r.users[0]?.user || { id: '', name: r.name, email: '' },
      _count: { orders: r._count.orders, menuItems: 0 },
    }));

    return {
      data: transformedRestaurants,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateRestaurantStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'INACTIVE',
  ) {
    return this.prisma.restaurant.update({
      where: { id },
      data: { status: status as RestaurantStatus },
    });
  }

  // Order Management
  async getOrders(params: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status as OrderStatus;
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { restaurant: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              user: { select: { email: true } },
            },
          },
          restaurant: { select: { id: true, name: true } },
          driver: {
            select: {
              id: true,
              fullName: true,
              user: { select: { email: true } },
            },
          },
          items: { include: { menuItem: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Transform to expected format
    const transformedOrders = orders.map((o) => ({
      ...o,
      customer: {
        id: o.customer.id,
        name: o.customer.fullName,
        email: o.customer.user.email,
      },
      driver: o.driver
        ? {
            id: o.driver.id,
            user: { name: o.driver.fullName },
          }
        : null,
    }));

    return {
      data: transformedOrders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOrderStatus(id: string, status: string) {
    return this.prisma.order.update({
      where: { id },
      data: { status: status as OrderStatus },
    });
  }

  // Driver Management
  async getDrivers(params: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status === 'available') where.isOnline = true;
    if (status === 'unavailable') where.isOnline = false;
    if (status === 'pending') where.status = DriverStatus.PENDING;
    if (status === 'approved') where.status = DriverStatus.APPROVED;
    if (search) {
      where.fullName = { contains: search, mode: 'insensitive' };
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, phone: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    // Transform to expected format
    const transformedDrivers = drivers.map((d) => ({
      ...d,
      isAvailable: d.isOnline,
      user: {
        id: d.user.id,
        name: d.fullName,
        email: d.user.email,
        phone: d.user.phone,
      },
    }));

    return {
      data: transformedDrivers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateDriverStatus(id: string, status: 'APPROVED' | 'SUSPENDED' | 'PENDING') {
    return this.prisma.driver.update({
      where: { id },
      data: { status: status as DriverStatus },
    });
  }

  // User Management
  async getUsers(params: { page?: number; limit?: number; role?: string; search?: string }) {
    const { page = 1, limit = 10, role, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role as UserRole;
    if (search) {
      where.OR = [{ email: { contains: search, mode: 'insensitive' } }];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          customer: { select: { fullName: true, _count: { select: { orders: true } } } },
          driver: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Transform to expected format
    const transformedUsers = users.map((u) => ({
      id: u.id,
      name: u.customer?.fullName || u.driver?.fullName || u.email.split('@')[0],
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      _count: { orders: u.customer?._count?.orders || 0 },
    }));

    return {
      data: transformedUsers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUserRole(id: string, role: 'ADMIN' | 'CUSTOMER' | 'RESTAURANT' | 'DRIVER') {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as UserRole },
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
