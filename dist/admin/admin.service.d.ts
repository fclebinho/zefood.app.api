import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDashboardMetrics(): Promise<{
        totalUsers: number;
        totalRestaurants: number;
        totalDrivers: number;
        totalOrders: number;
        pendingRestaurants: number;
        activeDrivers: number;
        todayOrders: number;
        todayRevenue: number | import("@prisma/client/runtime/library").Decimal;
    }>;
    getOrdersByStatus(): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        count: number;
    }[]>;
    getRevenueByDay(): Promise<{
        date: string;
        revenue: number | import("@prisma/client/runtime/library").Decimal;
        orders: number;
    }[]>;
    getRestaurants(params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }): Promise<{
        data: {
            owner: {
                id: string;
                email: string;
            };
            _count: {
                orders: number;
                menuItems: number;
            };
            users: ({
                user: {
                    id: string;
                    email: string;
                };
            } & {
                id: string;
                restaurantId: string;
                createdAt: Date;
                role: import(".prisma/client").$Enums.RestaurantRole;
                userId: string;
            })[];
            number: string;
            status: import(".prisma/client").$Enums.RestaurantStatus;
            description: string | null;
            deliveryFee: import("@prisma/client/runtime/library").Decimal;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            slug: string;
            cnpj: string | null;
            logoUrl: string | null;
            coverUrl: string | null;
            phone: string | null;
            email: string | null;
            street: string;
            complement: string | null;
            neighborhood: string;
            city: string;
            state: string;
            zipCode: string;
            latitude: import("@prisma/client/runtime/library").Decimal | null;
            longitude: import("@prisma/client/runtime/library").Decimal | null;
            isOpen: boolean;
            rating: import("@prisma/client/runtime/library").Decimal;
            ratingCount: number;
            minOrderValue: import("@prisma/client/runtime/library").Decimal;
            deliveryRadius: number;
            avgPrepTime: number;
        }[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    updateRestaurantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'INACTIVE'): Promise<{
        number: string;
        status: import(".prisma/client").$Enums.RestaurantStatus;
        description: string | null;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        slug: string;
        cnpj: string | null;
        logoUrl: string | null;
        coverUrl: string | null;
        phone: string | null;
        email: string | null;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        isOpen: boolean;
        rating: import("@prisma/client/runtime/library").Decimal;
        ratingCount: number;
        minOrderValue: import("@prisma/client/runtime/library").Decimal;
        deliveryRadius: number;
        avgPrepTime: number;
    }>;
    getOrders(params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }): Promise<{
        data: {
            customer: {
                id: string;
                name: string;
                email: string;
            };
            driver: {
                id: string;
                user: {
                    name: string;
                };
            } | null;
            restaurant: {
                id: string;
                name: string;
            };
            items: ({
                menuItem: {
                    name: string;
                };
            } & {
                id: string;
                notes: string | null;
                createdAt: Date;
                name: string;
                orderId: string;
                menuItemId: string;
                quantity: number;
                unitPrice: import("@prisma/client/runtime/library").Decimal;
                totalPrice: import("@prisma/client/runtime/library").Decimal;
            })[];
            status: import(".prisma/client").$Enums.OrderStatus;
            total: import("@prisma/client/runtime/library").Decimal;
            orderNumber: number;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            deliveryFee: import("@prisma/client/runtime/library").Decimal;
            discount: import("@prisma/client/runtime/library").Decimal;
            couponDiscount: import("@prisma/client/runtime/library").Decimal;
            id: string;
            customerId: string;
            restaurantId: string;
            driverId: string | null;
            deliveryAddress: import("@prisma/client/runtime/library").JsonValue;
            paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
            paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
            paymentId: string | null;
            pickupCode: string | null;
            deliveryCode: string | null;
            notes: string | null;
            cancelReason: string | null;
            couponId: string | null;
            estimatedPrepAt: Date | null;
            estimatedDeliveryAt: Date | null;
            acceptedAt: Date | null;
            readyAt: Date | null;
            pickedUpAt: Date | null;
            deliveredAt: Date | null;
            cancelledAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    updateOrderStatus(id: string, status: string): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        total: import("@prisma/client/runtime/library").Decimal;
        orderNumber: number;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        deliveryFee: import("@prisma/client/runtime/library").Decimal;
        discount: import("@prisma/client/runtime/library").Decimal;
        couponDiscount: import("@prisma/client/runtime/library").Decimal;
        id: string;
        customerId: string;
        restaurantId: string;
        driverId: string | null;
        deliveryAddress: import("@prisma/client/runtime/library").JsonValue;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        paymentId: string | null;
        pickupCode: string | null;
        deliveryCode: string | null;
        notes: string | null;
        cancelReason: string | null;
        couponId: string | null;
        estimatedPrepAt: Date | null;
        estimatedDeliveryAt: Date | null;
        acceptedAt: Date | null;
        readyAt: Date | null;
        pickedUpAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getDrivers(params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }): Promise<{
        data: {
            isAvailable: boolean;
            user: {
                id: string;
                name: string;
                email: string;
                phone: string | null;
            };
            _count: {
                orders: number;
            };
            status: import(".prisma/client").$Enums.DriverStatus;
            isOnline: boolean;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            rating: import("@prisma/client/runtime/library").Decimal;
            ratingCount: number;
            userId: string;
            fullName: string;
            cpf: string;
            birthDate: Date;
            vehicleType: import(".prisma/client").$Enums.VehicleType;
            vehiclePlate: string | null;
            vehicleModel: string | null;
            vehicleColor: string | null;
            currentLat: import("@prisma/client/runtime/library").Decimal | null;
            currentLng: import("@prisma/client/runtime/library").Decimal | null;
            lastLocationAt: Date | null;
            totalDeliveries: number;
        }[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    updateDriverStatus(id: string, status: 'APPROVED' | 'SUSPENDED' | 'PENDING'): Promise<{
        status: import(".prisma/client").$Enums.DriverStatus;
        isOnline: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        rating: import("@prisma/client/runtime/library").Decimal;
        ratingCount: number;
        userId: string;
        fullName: string;
        cpf: string;
        birthDate: Date;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        vehiclePlate: string | null;
        vehicleModel: string | null;
        vehicleColor: string | null;
        currentLat: import("@prisma/client/runtime/library").Decimal | null;
        currentLng: import("@prisma/client/runtime/library").Decimal | null;
        lastLocationAt: Date | null;
        totalDeliveries: number;
    }>;
    getUsers(params: {
        page?: number;
        limit?: number;
        role?: string;
        search?: string;
    }): Promise<{
        data: {
            id: string;
            name: string;
            email: string;
            phone: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            createdAt: Date;
            _count: {
                orders: number;
            };
        }[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    updateUserRole(id: string, role: 'ADMIN' | 'CUSTOMER' | 'RESTAURANT' | 'DRIVER'): Promise<{
        status: import(".prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        passwordHash: string;
        emailVerified: boolean;
        phoneVerified: boolean;
        avatarUrl: string | null;
    }>;
    deleteUser(id: string): Promise<{
        status: import(".prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        passwordHash: string;
        emailVerified: boolean;
        phoneVerified: boolean;
        avatarUrl: string | null;
    }>;
}
