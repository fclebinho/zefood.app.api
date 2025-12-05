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
exports.RestaurantsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let RestaurantsService = class RestaurantsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(query) {
        const { categoryId, search, page = 1, limit = 20 } = query;
        const where = {
            status: client_1.RestaurantStatus.ACTIVE,
            isOpen: true,
            ...(categoryId && {
                categories: {
                    some: { categoryId },
                },
            }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
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
    async findBySlug(slug) {
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
            throw new common_1.NotFoundException('Restaurant not found');
        }
        return restaurant;
    }
    async findById(id) {
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
            throw new common_1.NotFoundException('Restaurant not found');
        }
        return restaurant;
    }
    async getMenu(restaurantId) {
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
    async getRestaurantIdByUserId(userId) {
        const restaurantUser = await this.prisma.restaurantUser.findFirst({
            where: { userId },
            select: { restaurantId: true },
        });
        if (!restaurantUser) {
            throw new common_1.NotFoundException('Restaurant not found for this user');
        }
        return restaurantUser.restaurantId;
    }
    async getRestaurantByUserId(userId) {
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
    async updateSettings(userId, dto) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const { openingHours, ...restaurantData } = dto;
        const updateData = {};
        if (restaurantData.name)
            updateData.name = restaurantData.name;
        if (restaurantData.description !== undefined)
            updateData.description = restaurantData.description;
        if (restaurantData.phone !== undefined)
            updateData.phone = restaurantData.phone;
        if (restaurantData.email !== undefined)
            updateData.email = restaurantData.email;
        if (restaurantData.street)
            updateData.street = restaurantData.street;
        if (restaurantData.number)
            updateData.number = restaurantData.number;
        if (restaurantData.complement !== undefined)
            updateData.complement = restaurantData.complement;
        if (restaurantData.neighborhood)
            updateData.neighborhood = restaurantData.neighborhood;
        if (restaurantData.city)
            updateData.city = restaurantData.city;
        if (restaurantData.state)
            updateData.state = restaurantData.state;
        if (restaurantData.zipCode)
            updateData.zipCode = restaurantData.zipCode;
        if (restaurantData.deliveryFee !== undefined)
            updateData.deliveryFee = restaurantData.deliveryFee;
        if (restaurantData.minOrderValue !== undefined)
            updateData.minOrderValue = restaurantData.minOrderValue;
        if (restaurantData.avgPrepTime !== undefined)
            updateData.avgPrepTime = restaurantData.avgPrepTime;
        if (restaurantData.deliveryRadius !== undefined)
            updateData.deliveryRadius = restaurantData.deliveryRadius;
        if (restaurantData.isOpen !== undefined)
            updateData.isOpen = restaurantData.isOpen;
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
        return this.prisma.restaurant.update({
            where: { id: restaurantId },
            data: updateData,
            include: {
                hours: true,
            },
        });
    }
    async toggleOnlineStatus(userId) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const restaurant = await this.prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        if (!restaurant) {
            throw new common_1.NotFoundException('Restaurant not found');
        }
        return this.prisma.restaurant.update({
            where: { id: restaurantId },
            data: { isOpen: !restaurant.isOpen },
        });
    }
    async getRestaurantOrders(userId, query) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const { status, page, limit } = query;
        const where = { restaurantId };
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
    async getMenuCategories(userId) {
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
    async createMenuCategory(userId, dto) {
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
    async updateMenuCategory(userId, categoryId, dto) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const category = await this.prisma.menuCategory.findFirst({
            where: { id: categoryId, restaurantId },
        });
        if (!category) {
            throw new common_1.NotFoundException('Category not found');
        }
        return this.prisma.menuCategory.update({
            where: { id: categoryId },
            data: dto,
        });
    }
    async deleteMenuCategory(userId, categoryId) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const category = await this.prisma.menuCategory.findFirst({
            where: { id: categoryId, restaurantId },
        });
        if (!category) {
            throw new common_1.NotFoundException('Category not found');
        }
        await this.prisma.menuCategory.delete({
            where: { id: categoryId },
        });
        return { success: true };
    }
    async getMenuItems(userId, categoryId) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const where = {
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
    async createMenuItem(userId, dto) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const category = await this.prisma.menuCategory.findFirst({
            where: { id: dto.categoryId, restaurantId },
        });
        if (!category) {
            throw new common_1.ForbiddenException('Category does not belong to your restaurant');
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
    async updateMenuItem(userId, itemId, dto) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const item = await this.prisma.menuItem.findFirst({
            where: {
                id: itemId,
                category: { restaurantId },
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Menu item not found');
        }
        if (dto.categoryId) {
            const category = await this.prisma.menuCategory.findFirst({
                where: { id: dto.categoryId, restaurantId },
            });
            if (!category) {
                throw new common_1.ForbiddenException('Category does not belong to your restaurant');
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
    async toggleMenuItemAvailability(userId, itemId) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const item = await this.prisma.menuItem.findFirst({
            where: {
                id: itemId,
                category: { restaurantId },
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Menu item not found');
        }
        return this.prisma.menuItem.update({
            where: { id: itemId },
            data: { isAvailable: !item.isAvailable },
        });
    }
    async deleteMenuItem(userId, itemId) {
        const restaurantId = await this.getRestaurantIdByUserId(userId);
        const item = await this.prisma.menuItem.findFirst({
            where: {
                id: itemId,
                category: { restaurantId },
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Menu item not found');
        }
        await this.prisma.menuItem.delete({
            where: { id: itemId },
        });
        return { success: true };
    }
};
exports.RestaurantsService = RestaurantsService;
exports.RestaurantsService = RestaurantsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RestaurantsService);
//# sourceMappingURL=restaurants.service.js.map