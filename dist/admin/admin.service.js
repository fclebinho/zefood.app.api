"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let AdminService = class AdminService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardMetrics() {
        const [totalUsers, totalRestaurants, totalDrivers, totalOrders, pendingRestaurants, activeDrivers, todayOrders, todayRevenue,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.restaurant.count(),
            this.prisma.driver.count(),
            this.prisma.order.count(),
            this.prisma.restaurant.count({ where: { status: client_1.RestaurantStatus.PENDING } }),
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
                    status: client_1.OrderStatus.DELIVERED,
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
                    status: client_1.OrderStatus.DELIVERED,
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
    async getRestaurants(params) {
        const { page = 1, limit = 10, status, search } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
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
    async updateRestaurantStatus(id, status) {
        return this.prisma.restaurant.update({
            where: { id },
            data: { status: status },
        });
    }
    async getOrders(params) {
        const { page = 1, limit = 10, status, search } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
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
    async updateOrderStatus(id, status) {
        return this.prisma.order.update({
            where: { id },
            data: { status: status },
        });
    }
    async getDrivers(params) {
        const { page = 1, limit = 10, status, search } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (status === 'available')
            where.isOnline = true;
        if (status === 'unavailable')
            where.isOnline = false;
        if (status === 'pending')
            where.status = client_1.DriverStatus.PENDING;
        if (status === 'approved')
            where.status = client_1.DriverStatus.APPROVED;
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
    async updateDriverStatus(id, status) {
        return this.prisma.driver.update({
            where: { id },
            data: { status: status },
        });
    }
    async getUsers(params) {
        const { page = 1, limit = 10, role, search } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (role)
            where.role = role;
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
    async updateUserRole(id, role) {
        return this.prisma.user.update({
            where: { id },
            data: { role: role },
        });
    }
    async deleteUser(id) {
        return this.prisma.user.delete({ where: { id } });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map