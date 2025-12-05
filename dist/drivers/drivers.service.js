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
exports.DriversService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const orders_gateway_1 = require("../websocket/orders.gateway");
let DriversService = class DriversService {
    constructor(prisma, ordersGateway) {
        this.prisma = prisma;
        this.ordersGateway = ordersGateway;
    }
    async getProfile(userId) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        status: true,
                    },
                },
            },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        return driver;
    }
    async updateStatus(userId, isOnline) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        return this.prisma.driver.update({
            where: { id: driver.id },
            data: { isOnline },
        });
    }
    async updateLocation(userId, latitude, longitude) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        await this.prisma.driver.update({
            where: { id: driver.id },
            data: {
                currentLat: latitude,
                currentLng: longitude,
                lastLocationAt: new Date(),
            },
        });
        await this.prisma.driverLocation.create({
            data: {
                driverId: driver.id,
                latitude,
                longitude,
            },
        });
        return { success: true };
    }
    async getAvailableDeliveries(userId) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        const orders = await this.prisma.order.findMany({
            where: {
                status: client_1.OrderStatus.READY,
                driverId: null,
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        street: true,
                        number: true,
                        neighborhood: true,
                        city: true,
                        state: true,
                        latitude: true,
                        longitude: true,
                    },
                },
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
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
            take: 10,
        });
        return orders;
    }
    async acceptDelivery(userId, orderId) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        if (!driver.isOnline) {
            throw new common_1.BadRequestException('Driver is not online');
        }
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (order.status !== client_1.OrderStatus.READY) {
            throw new common_1.BadRequestException('Order is not ready for pickup');
        }
        if (order.driverId) {
            throw new common_1.BadRequestException('Order already has a driver');
        }
        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                driverId: driver.id,
                status: client_1.OrderStatus.PICKED_UP,
                pickedUpAt: new Date(),
                statusHistory: {
                    create: {
                        status: client_1.OrderStatus.PICKED_UP,
                        createdBy: userId,
                    },
                },
            },
            include: {
                restaurant: true,
                customer: {
                    include: {
                        user: {
                            select: {
                                phone: true,
                            },
                        },
                    },
                },
            },
        });
        this.ordersGateway.emitOrderStatusUpdate(updatedOrder);
        this.ordersGateway.emitDeliveryTaken(orderId);
        return updatedOrder;
    }
    async getCurrentDelivery(userId) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        const order = await this.prisma.order.findFirst({
            where: {
                driverId: driver.id,
                status: {
                    in: [
                        client_1.OrderStatus.PICKED_UP,
                        client_1.OrderStatus.IN_TRANSIT,
                    ],
                },
            },
            include: {
                restaurant: true,
                customer: {
                    select: {
                        fullName: true,
                    },
                },
                items: {
                    include: {
                        menuItem: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        return order;
    }
    async getDeliveryHistory(userId, page = 1, limit = 10) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        const [deliveries, total] = await Promise.all([
            this.prisma.order.findMany({
                where: {
                    driverId: driver.id,
                    status: client_1.OrderStatus.DELIVERED,
                },
                include: {
                    restaurant: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: { deliveredAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.order.count({
                where: {
                    driverId: driver.id,
                    status: client_1.OrderStatus.DELIVERED,
                },
            }),
        ]);
        return {
            data: deliveries,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getEarnings(userId, startDate, endDate) {
        const driver = await this.prisma.driver.findUnique({
            where: { userId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        const where = {
            driverId: driver.id,
            ...(startDate && endDate && {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            }),
        };
        const earnings = await this.prisma.driverEarning.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        const totalEarnings = earnings.reduce((sum, e) => sum + e.amount.toNumber(), 0);
        const totalDeliveries = earnings.filter(e => e.type === 'DELIVERY').length;
        return {
            earnings,
            summary: {
                totalEarnings,
                totalDeliveries,
                averagePerDelivery: totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0,
            },
        };
    }
};
exports.DriversService = DriversService;
exports.DriversService = DriversService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_gateway_1.OrdersGateway])
], DriversService);
//# sourceMappingURL=drivers.service.js.map