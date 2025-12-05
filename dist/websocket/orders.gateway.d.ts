import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinOrder(client: Socket, orderId: string): {
        event: string;
        data: {
            orderId: string;
        };
    };
    handleLeaveOrder(client: Socket, orderId: string): {
        event: string;
        data: {
            orderId: string;
        };
    };
    handleJoinRestaurant(client: Socket, restaurantId: string): {
        event: string;
        data: {
            restaurantId: string;
        };
    };
    handleJoinDriver(client: Socket, driverId: string): {
        event: string;
        data: {
            driverId: string;
        };
    };
    emitOrderStatusUpdate(order: any): void;
    emitNewOrder(order: any): void;
    emitNewAvailableDelivery(order: any): void;
    emitDeliveryTaken(orderId: string): void;
}
