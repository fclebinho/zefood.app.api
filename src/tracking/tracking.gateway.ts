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

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private driverSockets: Map<string, string> = new Map(); // driverId -> socketId

  constructor(private readonly trackingService: TrackingService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Tracking client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Tracking client disconnected: ${client.id}`);
    // Remove driver from active connections
    for (const [driverId, socketId] of this.driverSockets.entries()) {
      if (socketId === client.id) {
        this.driverSockets.delete(driverId);
        this.logger.log(`Driver ${driverId} disconnected from tracking`);
        break;
      }
    }
  }

  // Customer subscribes to order tracking
  @SubscribeMessage('subscribeToOrder')
  handleSubscribeToOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    client.join(`tracking:order:${orderId}`);
    this.logger.log(`Client ${client.id} subscribed to order tracking: ${orderId}`);
    return { event: 'subscribed', data: { orderId } };
  }

  // Customer unsubscribes from order tracking
  @SubscribeMessage('unsubscribeFromOrder')
  handleUnsubscribeFromOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    client.leave(`tracking:order:${orderId}`);
    this.logger.log(`Client ${client.id} unsubscribed from order tracking: ${orderId}`);
    return { event: 'unsubscribed', data: { orderId } };
  }

  // Driver registers for location updates
  @SubscribeMessage('driverConnect')
  handleDriverConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() driverId: string,
  ) {
    this.driverSockets.set(driverId, client.id);
    client.join(`tracking:driver:${driverId}`);
    this.logger.log(`Driver ${driverId} connected for tracking`);
    return { event: 'connected', data: { driverId } };
  }

  // Driver sends location update
  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdate,
  ) {
    try {
      // Save location to database
      await this.trackingService.updateDriverLocation(data.driverId, {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        speed: data.speed,
        heading: data.heading,
      });

      // If there's an active order, broadcast to order subscribers
      if (data.orderId) {
        this.emitDriverLocation(data.orderId, {
          driverId: data.driverId,
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading,
          speed: data.speed,
          timestamp: new Date(),
        });
      }

      return { event: 'locationUpdated', data: { success: true } };
    } catch (error) {
      this.logger.error(`Error updating location: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  // Emit driver location to order subscribers
  emitDriverLocation(
    orderId: string,
    location: {
      driverId: string;
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
      timestamp: Date;
    },
  ) {
    this.server.to(`tracking:order:${orderId}`).emit('driverLocation', {
      orderId,
      ...location,
    });
    this.logger.debug(`Emitted driver location for order ${orderId}`);
  }

  // Notify that driver has arrived
  emitDriverArrived(orderId: string, location: 'restaurant' | 'customer') {
    this.server.to(`tracking:order:${orderId}`).emit('driverArrived', {
      orderId,
      location,
      timestamp: new Date(),
    });
    this.logger.log(`Driver arrived at ${location} for order ${orderId}`);
  }

  // Emit order status update to tracking subscribers
  emitOrderStatusUpdate(order: any) {
    this.server.to(`tracking:order:${order.id}`).emit('orderStatusUpdate', {
      orderId: order.id,
      status: order.status,
      order,
    });
    this.logger.log(`Emitted tracking status update for order ${order.id}: ${order.status}`);
  }

  // Get order tracking info via REST-like socket call
  @SubscribeMessage('getOrderTracking')
  async handleGetOrderTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    try {
      const tracking = await this.trackingService.getOrderTracking(orderId);
      return { event: 'orderTracking', data: tracking };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }
}
