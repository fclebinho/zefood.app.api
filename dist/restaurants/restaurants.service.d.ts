import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { CreateMenuCategoryDto, UpdateMenuCategoryDto } from './dto/menu-category.dto';
import { UpdateRestaurantSettingsDto } from './dto/restaurant-settings.dto';
export declare class RestaurantsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(query: {
        categoryId?: string;
        search?: string;
        latitude?: number;
        longitude?: number;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            categories: ({
                category: {
                    name: string;
                    id: string;
                    createdAt: Date;
                    sortOrder: number;
                    isActive: boolean;
                    slug: string;
                    icon: string | null;
                };
            } & {
                categoryId: string;
                restaurantId: string;
            })[];
        } & {
            number: string;
            rating: import("@prisma/client/runtime/library").Decimal;
            name: string;
            phone: string | null;
            street: string;
            complement: string | null;
            neighborhood: string;
            city: string;
            state: string;
            zipCode: string;
            latitude: import("@prisma/client/runtime/library").Decimal | null;
            longitude: import("@prisma/client/runtime/library").Decimal | null;
            id: string;
            email: string | null;
            status: import(".prisma/client").$Enums.RestaurantStatus;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deliveryFee: import("@prisma/client/runtime/library").Decimal;
            minOrderValue: import("@prisma/client/runtime/library").Decimal;
            avgPrepTime: number;
            deliveryRadius: number;
            isOpen: boolean;
            slug: string;
            cnpj: string | null;
            logoUrl: string | null;
            coverUrl: string | null;
            ratingCount: number;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findBySlug(slug: string): Promise<{
        hours: {
            id: string;
            dayOfWeek: number;
            openTime: Date | null;
            closeTime: Date | null;
            isClosed: boolean;
            restaurantId: string;
        }[];
        categories: ({
            category: {
                name: string;
                id: string;
                createdAt: Date;
                sortOrder: number;
                isActive: boolean;
                slug: string;
                icon: string | null;
            };
        } & {
            categoryId: string;
            restaurantId: string;
        })[];
        menuCategories: ({
            items: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                categoryId: string;
                description: string | null;
                price: import("@prisma/client/runtime/library").Decimal;
                imageUrl: string | null;
                isAvailable: boolean;
                sortOrder: number;
                prepTime: number | null;
            }[];
        } & {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            sortOrder: number;
            isActive: boolean;
            restaurantId: string;
        })[];
    } & {
        number: string;
        rating: import("@prisma/client/runtime/library").Decimal;
        name: string;
        phone: string | null;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        id: string;
        email: string | null;
        status: import(".prisma/client").$Enums.RestaurantStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
        avgPrepTime: number;
        deliveryRadius: number;
        isOpen: boolean;
        slug: string;
        cnpj: string | null;
        logoUrl: string | null;
        coverUrl: string | null;
        ratingCount: number;
    }>;
    findById(id: string): Promise<{
        hours: {
            id: string;
            dayOfWeek: number;
            openTime: Date | null;
            closeTime: Date | null;
            isClosed: boolean;
            restaurantId: string;
        }[];
        categories: ({
            category: {
                name: string;
                id: string;
                createdAt: Date;
                sortOrder: number;
                isActive: boolean;
                slug: string;
                icon: string | null;
            };
        } & {
            categoryId: string;
            restaurantId: string;
        })[];
    } & {
        number: string;
        rating: import("@prisma/client/runtime/library").Decimal;
        name: string;
        phone: string | null;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        id: string;
        email: string | null;
        status: import(".prisma/client").$Enums.RestaurantStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
        avgPrepTime: number;
        deliveryRadius: number;
        isOpen: boolean;
        slug: string;
        cnpj: string | null;
        logoUrl: string | null;
        coverUrl: string | null;
        ratingCount: number;
    }>;
    getMenu(restaurantId: string): Promise<({
        items: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            description: string | null;
            price: import("@prisma/client/runtime/library").Decimal;
            imageUrl: string | null;
            isAvailable: boolean;
            sortOrder: number;
            prepTime: number | null;
        }[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        sortOrder: number;
        isActive: boolean;
        restaurantId: string;
    })[]>;
    getCategories(): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        sortOrder: number;
        isActive: boolean;
        slug: string;
        icon: string | null;
    }[]>;
    private getRestaurantIdByUserId;
    getRestaurantByUserId(userId: string): Promise<({
        hours: {
            id: string;
            dayOfWeek: number;
            openTime: Date | null;
            closeTime: Date | null;
            isClosed: boolean;
            restaurantId: string;
        }[];
        categories: ({
            category: {
                name: string;
                id: string;
                createdAt: Date;
                sortOrder: number;
                isActive: boolean;
                slug: string;
                icon: string | null;
            };
        } & {
            categoryId: string;
            restaurantId: string;
        })[];
    } & {
        number: string;
        rating: import("@prisma/client/runtime/library").Decimal;
        name: string;
        phone: string | null;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        id: string;
        email: string | null;
        status: import(".prisma/client").$Enums.RestaurantStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
        avgPrepTime: number;
        deliveryRadius: number;
        isOpen: boolean;
        slug: string;
        cnpj: string | null;
        logoUrl: string | null;
        coverUrl: string | null;
        ratingCount: number;
    }) | null>;
    updateSettings(userId: string, dto: UpdateRestaurantSettingsDto): Promise<{
        hours: {
            id: string;
            dayOfWeek: number;
            openTime: Date | null;
            closeTime: Date | null;
            isClosed: boolean;
            restaurantId: string;
        }[];
    } & {
        number: string;
        rating: import("@prisma/client/runtime/library").Decimal;
        name: string;
        phone: string | null;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        id: string;
        email: string | null;
        status: import(".prisma/client").$Enums.RestaurantStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
        avgPrepTime: number;
        deliveryRadius: number;
        isOpen: boolean;
        slug: string;
        cnpj: string | null;
        logoUrl: string | null;
        coverUrl: string | null;
        ratingCount: number;
    }>;
    toggleOnlineStatus(userId: string): Promise<{
        number: string;
        rating: import("@prisma/client/runtime/library").Decimal;
        name: string;
        phone: string | null;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        id: string;
        email: string | null;
        status: import(".prisma/client").$Enums.RestaurantStatus;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
        avgPrepTime: number;
        deliveryRadius: number;
        isOpen: boolean;
        slug: string;
        cnpj: string | null;
        logoUrl: string | null;
        coverUrl: string | null;
        ratingCount: number;
    }>;
    getRestaurantOrders(userId: string, query: {
        status?: string;
        page: number;
        limit: number;
    }): Promise<{
        customer: {
            fullName: string;
            phone: string | null;
        };
        items: ({
            menuItem: {
                name: string;
                imageUrl: string | null;
            };
        } & {
            name: string;
            id: string;
            createdAt: Date;
            notes: string | null;
            orderId: string;
            menuItemId: string;
            quantity: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            totalPrice: import("@prisma/client/runtime/library").Decimal;
        })[];
        id: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        updatedAt: Date;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        restaurantId: string;
        total: import("@prisma/client/runtime/library").Decimal;
        orderNumber: number;
        customerId: string;
        driverId: string | null;
        deliveryAddress: import("@prisma/client/runtime/library").JsonValue;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        discount: import("@prisma/client/runtime/library").Decimal;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        paymentId: string | null;
        pickupCode: string | null;
        deliveryCode: string | null;
        notes: string | null;
        cancelReason: string | null;
        couponId: string | null;
        couponDiscount: import("@prisma/client/runtime/library").Decimal;
        estimatedPrepAt: Date | null;
        estimatedDeliveryAt: Date | null;
        acceptedAt: Date | null;
        readyAt: Date | null;
        pickedUpAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
    }[]>;
    getMenuCategories(userId: string): Promise<({
        items: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
            description: string | null;
            price: import("@prisma/client/runtime/library").Decimal;
            imageUrl: string | null;
            isAvailable: boolean;
            sortOrder: number;
            prepTime: number | null;
        }[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        sortOrder: number;
        isActive: boolean;
        restaurantId: string;
    })[]>;
    createMenuCategory(userId: string, dto: CreateMenuCategoryDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        sortOrder: number;
        isActive: boolean;
        restaurantId: string;
    }>;
    updateMenuCategory(userId: string, categoryId: string, dto: UpdateMenuCategoryDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        sortOrder: number;
        isActive: boolean;
        restaurantId: string;
    }>;
    deleteMenuCategory(userId: string, categoryId: string): Promise<{
        success: boolean;
    }>;
    getMenuItems(userId: string, categoryId?: string): Promise<({
        category: {
            name: string;
            id: string;
        };
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        imageUrl: string | null;
        isAvailable: boolean;
        sortOrder: number;
        prepTime: number | null;
    })[]>;
    createMenuItem(userId: string, dto: CreateMenuItemDto): Promise<{
        category: {
            name: string;
            id: string;
        };
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        imageUrl: string | null;
        isAvailable: boolean;
        sortOrder: number;
        prepTime: number | null;
    }>;
    updateMenuItem(userId: string, itemId: string, dto: UpdateMenuItemDto): Promise<{
        category: {
            name: string;
            id: string;
        };
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        imageUrl: string | null;
        isAvailable: boolean;
        sortOrder: number;
        prepTime: number | null;
    }>;
    toggleMenuItemAvailability(userId: string, itemId: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        imageUrl: string | null;
        isAvailable: boolean;
        sortOrder: number;
        prepTime: number | null;
    }>;
    deleteMenuItem(userId: string, itemId: string): Promise<{
        success: boolean;
    }>;
}
