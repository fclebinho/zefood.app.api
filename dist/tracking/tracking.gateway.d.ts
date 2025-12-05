import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TrackingService } from './tracking.service';
interface LocationUpdate {
    driverId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    orderId?: string;
}
export declare class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly trackingService;
    server: Server;
    private readonly logger;
    private driverSockets;
    constructor(trackingService: TrackingService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleSubscribeToOrder(client: Socket, orderId: string): {
        event: string;
        data: {
            orderId: string;
        };
    };
    handleUnsubscribeFromOrder(client: Socket, orderId: string): {
        event: string;
        data: {
            orderId: string;
        };
    };
    handleDriverConnect(client: Socket, driverId: string): {
        event: string;
        data: {
            driverId: string;
        };
    };
    handleUpdateLocation(client: Socket, data: LocationUpdate): Promise<{
        event: string;
        data: {
            success: boolean;
            message?: undefined;
        };
    } | {
        event: string;
        data: {
            message: any;
            success?: undefined;
        };
    }>;
    emitDriverLocation(orderId: string, location: {
        driverId: string;
        latitude: number;
        longitude: number;
        heading?: number;
        speed?: number;
        timestamp: Date;
    }): void;
    emitDriverArrived(orderId: string, location: 'restaurant' | 'customer'): void;
    handleGetOrderTracking(client: Socket, orderId: string): Promise<{
        event: string;
        data: {
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
        };
    } | {
        event: string;
        data: {
            message: any;
        };
    }>;
}
export {};
