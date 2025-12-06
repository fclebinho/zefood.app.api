import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:8081',
      'https://zefood.app',
      'https://www.zefood.app',
    ],
    credentials: true,
  },
  namespace: '/orders',
  transports: ['websocket', 'polling'],
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Customer joins their order room
  @SubscribeMessage('joinOrder')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    client.join(`order:${orderId}`);
    this.logger.log(`Client ${client.id} joined order:${orderId}`);
    return { event: 'joined', data: { orderId } };
  }

  // Customer leaves order room
  @SubscribeMessage('leaveOrder')
  handleLeaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    client.leave(`order:${orderId}`);
    this.logger.log(`Client ${client.id} left order:${orderId}`);
    return { event: 'left', data: { orderId } };
  }

  // Restaurant joins their restaurant room
  @SubscribeMessage('joinRestaurant')
  handleJoinRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() restaurantId: string,
  ) {
    client.join(`restaurant:${restaurantId}`);
    this.logger.log(`Client ${client.id} joined restaurant:${restaurantId}`);
    return { event: 'joined', data: { restaurantId } };
  }

  // Driver joins driver room
  @SubscribeMessage('joinDriver')
  handleJoinDriver(
    @ConnectedSocket() client: Socket,
    @MessageBody() driverId: string,
  ) {
    client.join(`driver:${driverId}`);
    client.join('drivers:available'); // Join available deliveries room
    this.logger.log(`Client ${client.id} joined driver:${driverId}`);
    return { event: 'joined', data: { driverId } };
  }

  // Emit order status update to all relevant parties
  emitOrderStatusUpdate(order: any) {
    // Notify customer
    this.server.to(`order:${order.id}`).emit('orderStatusUpdate', {
      orderId: order.id,
      status: order.status,
      order,
    });

    // Notify restaurant
    if (order.restaurantId) {
      this.server.to(`restaurant:${order.restaurantId}`).emit('orderStatusUpdate', {
        orderId: order.id,
        status: order.status,
        order,
      });
    }

    // Notify driver if assigned
    if (order.driverId) {
      this.server.to(`driver:${order.driverId}`).emit('orderStatusUpdate', {
        orderId: order.id,
        status: order.status,
        order,
      });
    }

    this.logger.log(`Emitted status update for order ${order.id}: ${order.status}`);
  }

  // Emit new order to restaurant
  emitNewOrder(order: any) {
    if (order.restaurantId) {
      this.server.to(`restaurant:${order.restaurantId}`).emit('newOrder', {
        order,
      });
      this.logger.log(`Emitted new order to restaurant ${order.restaurantId}`);
    }
  }

  // Emit new available delivery to all online drivers
  emitNewAvailableDelivery(order: any) {
    this.server.to('drivers:available').emit('newAvailableDelivery', {
      order,
    });
    this.logger.log(`Emitted new available delivery for order ${order.id}`);
  }

  // Emit delivery taken (remove from available list)
  emitDeliveryTaken(orderId: string) {
    this.server.to('drivers:available').emit('deliveryTaken', {
      orderId,
    });
    this.logger.log(`Emitted delivery taken for order ${orderId}`);
  }
}
