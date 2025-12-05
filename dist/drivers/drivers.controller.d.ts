import { DriversService } from './drivers.service';
import { UpdateLocationDto } from './dto/update-location.dto';
export declare class DriversController {
    private readonly driversService;
    constructor(driversService: DriversService);
    getProfile(userId: string): Promise<{
        user: {
            id: string;
            email: string;
            status: import(".prisma/client").$Enums.UserStatus;
        };
    } & {
        rating: import("@prisma/client/runtime/library").Decimal;
        id: string;
        status: import(".prisma/client").$Enums.DriverStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        fullName: string;
        cpf: string;
        birthDate: Date;
        ratingCount: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        vehiclePlate: string | null;
        vehicleModel: string | null;
        vehicleColor: string | null;
        isOnline: boolean;
        currentLat: import("@prisma/client/runtime/library").Decimal | null;
        currentLng: import("@prisma/client/runtime/library").Decimal | null;
        lastLocationAt: Date | null;
        totalDeliveries: number;
    }>;
    updateStatus(userId: string, isOnline: boolean): Promise<{
        rating: import("@prisma/client/runtime/library").Decimal;
        id: string;
        status: import(".prisma/client").$Enums.DriverStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        fullName: string;
        cpf: string;
        birthDate: Date;
        ratingCount: number;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        vehiclePlate: string | null;
        vehicleModel: string | null;
        vehicleColor: string | null;
        isOnline: boolean;
        currentLat: import("@prisma/client/runtime/library").Decimal | null;
        currentLng: import("@prisma/client/runtime/library").Decimal | null;
        lastLocationAt: Date | null;
        totalDeliveries: number;
    }>;
    updateLocation(userId: string, updateLocationDto: UpdateLocationDto): Promise<{
        success: boolean;
    }>;
    getAvailableDeliveries(userId: string): Promise<({
        customer: {
            user: {
                phone: string | null;
            };
            fullName: string;
        };
        restaurant: {
            number: string;
            name: string;
            phone: string | null;
            street: string;
            neighborhood: string;
            city: string;
            state: string;
            latitude: import("@prisma/client/runtime/library").Decimal | null;
            longitude: import("@prisma/client/runtime/library").Decimal | null;
            id: string;
        };
        items: ({
            menuItem: {
                name: string;
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
    } & {
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
    })[]>;
    acceptDelivery(userId: string, orderId: string): Promise<{
        customer: {
            user: {
                phone: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            fullName: string;
            cpf: string | null;
            birthDate: Date | null;
        };
        restaurant: {
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
        };
    } & {
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
    }>;
    getCurrentDelivery(userId: string): Promise<({
        customer: {
            fullName: string;
        };
        restaurant: {
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
        };
        items: ({
            menuItem: {
                name: string;
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
    } & {
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
    }) | null>;
    getDeliveryHistory(userId: string, page?: string, limit?: string): Promise<{
        data: ({
            restaurant: {
                name: string;
            };
        } & {
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
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getEarnings(userId: string, startDate?: string, endDate?: string): Promise<{
        earnings: {
            id: string;
            createdAt: Date;
            description: string | null;
            driverId: string;
            orderId: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            type: import(".prisma/client").$Enums.EarningType;
        }[];
        summary: {
            totalEarnings: number;
            totalDeliveries: number;
            averagePerDelivery: number;
        };
    }>;
}
