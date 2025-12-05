import { TrackingService } from './tracking.service';
declare class UpdateLocationDto {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
}
export declare class TrackingController {
    private readonly trackingService;
    constructor(trackingService: TrackingService);
    updateLocation(req: any, dto: UpdateLocationDto): Promise<{
        driverId: string;
        latitude: number;
        longitude: number;
        updatedAt: Date;
    }>;
    getDriverLocation(driverId: string): Promise<{
        driverId: string;
        name: string;
        latitude: number | null;
        longitude: number | null;
        lastUpdate: Date | null;
        vehicleType: import(".prisma/client").$Enums.VehicleType;
        vehiclePlate: string | null;
    }>;
    getOrderTracking(orderId: string): Promise<{
        orderId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        driver: {
            id: string;
            name: string;
            phone: string | null;
            vehicleType: import(".prisma/client").$Enums.VehicleType;
            vehiclePlate: string | null;
            location: {
                latitude: number;
                longitude: number;
                lastUpdate: Date | null;
            } | null;
        } | null;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        deliveryAddress: {
            street: any;
            number: any;
            complement: any;
            neighborhood: any;
            city: any;
            state: any;
        } | null;
        estimatedDelivery: Date | null;
    }>;
    getActiveDelivery(req: any): Promise<{
        orderId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        customer: {
            id: string;
            name: string;
        };
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        deliveryAddress: {
            street: any;
            number: any;
            complement: any;
            neighborhood: any;
            city: any;
            state: any;
            latitude: any;
            longitude: any;
        } | null;
    } | null>;
    private getDriverFromUser;
}
export {};
