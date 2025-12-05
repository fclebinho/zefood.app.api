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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const orders_gateway_1 = require("../websocket/orders.gateway");
let OrdersService = class OrdersService {
    constructor(prisma, ordersGateway) {
        this.prisma = prisma;
        this.ordersGateway = ordersGateway;
    }
    async create(customerId, createOrderDto) {
        const customer = await this.prisma.customer.findUnique({
            where: { userId: customerId },
        });
        if (!customer) {
            throw new common_1.NotFoundException('Customer not found');
        }
        const restaurant = await this.prisma.restaurant.findUnique({
            where: { id: createOrderDto.restaurantId },
        });
        if (!restaurant) {
            throw new common_1.NotFoundException('Restaurant not found');
        }
        if (!restaurant.isOpen) {
            throw new common_1.BadRequestException('Restaurant is closed');
        }
        let deliveryAddressData;
        if (createOrderDto.addressId) {
            const address = await this.prisma.address.findFirst({
                where: {
                    id: createOrderDto.addressId,
                    userId: customerId,
                },
            });
            if (!address) {
                throw new common_1.NotFoundException('Address not found');
            }
            deliveryAddressData = {
                street: address.street,
                number: address.number,
                complement: address.complement || undefined,
                neighborhood: address.neighborhood,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                latitude: address.latitude?.toNumber(),
                longitude: address.longitude?.toNumber(),
            };
        }
        else if (createOrderDto.deliveryAddress) {
            deliveryAddressData = {
                street: createOrderDto.deliveryAddress.street,
                number: createOrderDto.deliveryAddress.number,
                complement: createOrderDto.deliveryAddress.complement,
                neighborhood: createOrderDto.deliveryAddress.neighborhood,
                city: createOrderDto.deliveryAddress.city,
                state: createOrderDto.deliveryAddress.state,
                zipCode: createOrderDto.deliveryAddress.zipCode,
            };
        }
        else {
            throw new common_1.BadRequestException('Delivery address is required');
        }
        const menuItems = await this.prisma.menuItem.findMany({
            where: {
                id: { in: createOrderDto.items.map((i) => i.menuItemId) },
            },
            include: {
                category: {
                    include: {
                        restaurant: true,
                    },
                },
            },
        });
        const invalidItems = menuItems.filter((item) => item.category.restaurant.id !== restaurant.id);
        if (invalidItems.length > 0 || menuItems.length !== createOrderDto.items.length) {
            throw new common_1.BadRequestException('Invalid menu items');
        }
        let subtotal = 0;
        const orderItems = createOrderDto.items.map((item) => {
            const menuItem = menuItems.find((m) => m.id === item.menuItemId);
            if (!menuItem) {
                throw new common_1.BadRequestException(`Menu item ${item.menuItemId} not found`);
            }
            const itemTotal = menuItem.price.toNumber() * item.quantity;
            subtotal += itemTotal;
            return {
                menuItemId: item.menuItemId,
                name: menuItem.name,
                quantity: item.quantity,
                unitPrice: menuItem.price,
                totalPrice: itemTotal,
                notes: item.notes,
            };
        });
        const deliveryFee = restaurant.deliveryFee.toNumber();
        const total = subtotal + deliveryFee;
        const order = await this.prisma.order.create({
            data: {
                customerId: customer.id,
                restaurantId: restaurant.id,
                deliveryAddress: deliveryAddressData,
                status: client_1.OrderStatus.PENDING,
                subtotal,
                deliveryFee,
                discount: 0,
                total,
                paymentMethod: createOrderDto.paymentMethod,
                notes: createOrderDto.notes,
                items: {
                    create: orderItems,
                },
                statusHistory: {
                    create: {
                        status: client_1.OrderStatus.PENDING,
                    },
                },
            },
            include: {
                items: {
                    include: {
                        menuItem: true,
                    },
                },
                restaurant: true,
            },
        });
        this.ordersGateway.emitNewOrder(order);
        return order;
    }
    async findByCustomer(customerId, page = 1, limit = 10) {
        const customer = await this.prisma.customer.findUnique({
            where: { userId: customerId },
        });
        if (!customer) {
            throw new common_1.NotFoundException('Customer not found');
        }
        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where: { customerId: customer.id },
                include: {
                    restaurant: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            logoUrl: true,
                        },
                    },
                    items: {
                        include: {
                            menuItem: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.order.count({ where: { customerId: customer.id } }),
        ]);
        return {
            data: orders,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async findById(orderId, userId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                customer: {
                    include: {
                        user: {
                            select: { id: true },
                        },
                    },
                },
                restaurant: true,
                driver: true,
                items: {
                    include: {
                        menuItem: true,
                    },
                },
                statusHistory: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (order.customer.user.id !== userId) {
            throw new common_1.NotFoundException('Order not found');
        }
        return order;
    }
    async updateStatus(orderId, status, userId, _role) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                restaurant: {
                    include: {
                        users: true,
                    },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        const validTransitions = {
            [client_1.OrderStatus.PENDING]: [client_1.OrderStatus.PAID, client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.PAID]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.CONFIRMED]: [client_1.OrderStatus.ACCEPTED, client_1.OrderStatus.PREPARING, client_1.OrderStatus.READY, client_1.OrderStatus.REJECTED, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.ACCEPTED]: [client_1.OrderStatus.PREPARING, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.PREPARING]: [client_1.OrderStatus.READY, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.READY]: [client_1.OrderStatus.PICKED_UP, client_1.OrderStatus.OUT_FOR_DELIVERY, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.PICKED_UP]: [client_1.OrderStatus.IN_TRANSIT, client_1.OrderStatus.OUT_FOR_DELIVERY],
            [client_1.OrderStatus.IN_TRANSIT]: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.OUT_FOR_DELIVERY]: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.DELIVERED]: [],
            [client_1.OrderStatus.CANCELLED]: [],
            [client_1.OrderStatus.REJECTED]: [],
        };
        if (!validTransitions[order.status].includes(status)) {
            throw new common_1.BadRequestException(`Cannot transition from ${order.status} to ${status}`);
        }
        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                statusHistory: {
                    create: {
                        status,
                        createdBy: userId,
                    },
                },
            },
            include: {
                items: true,
                restaurant: true,
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });
        this.ordersGateway.emitOrderStatusUpdate(updatedOrder);
        if (status === client_1.OrderStatus.READY && !updatedOrder.driverId) {
            this.ordersGateway.emitNewAvailableDelivery(updatedOrder);
        }
        return updatedOrder;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_gateway_1.OrdersGateway])
], OrdersService);
//# sourceMappingURL=orders.service.js.map