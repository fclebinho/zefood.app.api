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
exports.TrackingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TrackingService = class TrackingService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async updateDriverLocation(driverId, location) {
        const driver = await this.prisma.driver.findUnique({
            where: { id: driverId },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        await this.prisma.driver.update({
            where: { id: driverId },
            data: {
                currentLat: location.latitude,
                currentLng: location.longitude,
                lastLocationAt: new Date(),
            },
        });
        await this.prisma.driverLocation.create({
            data: {
                driverId,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                speed: location.speed,
                heading: location.heading,
            },
        });
        return {
            driverId,
            latitude: location.latitude,
            longitude: location.longitude,
            updatedAt: new Date(),
        };
    }
    async getDriverLocation(driverId) {
        const driver = await this.prisma.driver.findUnique({
            where: { id: driverId },
            select: {
                id: true,
                fullName: true,
                currentLat: true,
                currentLng: true,
                lastLocationAt: true,
                vehicleType: true,
                vehiclePlate: true,
            },
        });
        if (!driver) {
            throw new common_1.NotFoundException('Driver not found');
        }
        return {
            driverId: driver.id,
            name: driver.fullName,
            latitude: driver.currentLat ? Number(driver.currentLat) : null,
            longitude: driver.currentLng ? Number(driver.currentLng) : null,
            lastUpdate: driver.lastLocationAt,
            vehicleType: driver.vehicleType,
            vehiclePlate: driver.vehiclePlate,
        };
    }
    async getOrderTracking(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                driver: {
                    select: {
                        id: true,
                        fullName: true,
                        currentLat: true,
                        currentLng: true,
                        lastLocationAt: true,
                        vehicleType: true,
                        vehiclePlate: true,
                        user: {
                            select: {
                                phone: true,
                            },
                        },
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        number: true,
                        neighborhood: true,
                        city: true,
                        state: true,
                    },
                },
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        const deliveryAddress = order.deliveryAddress;
        return {
            orderId: order.id,
            status: order.status,
            driver: order.driver
                ? {
                    id: order.driver.id,
                    name: order.driver.fullName,
                    phone: order.driver.user?.phone,
                    vehicleType: order.driver.vehicleType,
                    vehiclePlate: order.driver.vehiclePlate,
                    location: order.driver.currentLat
                        ? {
                            latitude: Number(order.driver.currentLat),
                            longitude: Number(order.driver.currentLng),
                            lastUpdate: order.driver.lastLocationAt,
                        }
                        : null,
                }
                : null,
            restaurant: {
                id: order.restaurant.id,
                name: order.restaurant.name,
                address: `${order.restaurant.street}, ${order.restaurant.number} - ${order.restaurant.neighborhood}`,
            },
            deliveryAddress: deliveryAddress
                ? {
                    street: deliveryAddress.street,
                    number: deliveryAddress.number,
                    complement: deliveryAddress.complement,
                    neighborhood: deliveryAddress.neighborhood,
                    city: deliveryAddress.city,
                    state: deliveryAddress.state,
                }
                : null,
            estimatedDelivery: order.estimatedDeliveryAt,
        };
    }
    async getActiveDeliveryForDriver(driverId) {
        const order = await this.prisma.order.findFirst({
            where: {
                driverId,
                status: {
                    in: ['PICKED_UP', 'IN_TRANSIT'],
                },
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        number: true,
                        neighborhood: true,
                        city: true,
                        state: true,
                    },
                },
            },
        });
        if (!order) {
            return null;
        }
        const deliveryAddress = order.deliveryAddress;
        return {
            orderId: order.id,
            status: order.status,
            customer: {
                id: order.customer.id,
                name: order.customer.fullName,
            },
            restaurant: {
                id: order.restaurant.id,
                name: order.restaurant.name,
                address: `${order.restaurant.street}, ${order.restaurant.number}`,
            },
            deliveryAddress: deliveryAddress
                ? {
                    street: deliveryAddress.street,
                    number: deliveryAddress.number,
                    complement: deliveryAddress.complement,
                    neighborhood: deliveryAddress.neighborhood,
                    city: deliveryAddress.city,
                    state: deliveryAddress.state,
                    latitude: deliveryAddress.latitude,
                    longitude: deliveryAddress.longitude,
                }
                : null,
        };
    }
};
exports.TrackingService = TrackingService;
exports.TrackingService = TrackingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TrackingService);
//# sourceMappingURL=tracking.service.js.map