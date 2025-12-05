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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TrackingGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const tracking_service_1 = require("./tracking.service");
let TrackingGateway = TrackingGateway_1 = class TrackingGateway {
    constructor(trackingService) {
        this.trackingService = trackingService;
        this.logger = new common_1.Logger(TrackingGateway_1.name);
        this.driverSockets = new Map();
    }
    handleConnection(client) {
        this.logger.log(`Tracking client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Tracking client disconnected: ${client.id}`);
        for (const [driverId, socketId] of this.driverSockets.entries()) {
            if (socketId === client.id) {
                this.driverSockets.delete(driverId);
                this.logger.log(`Driver ${driverId} disconnected from tracking`);
                break;
            }
        }
    }
    handleSubscribeToOrder(client, orderId) {
        client.join(`tracking:order:${orderId}`);
        this.logger.log(`Client ${client.id} subscribed to order tracking: ${orderId}`);
        return { event: 'subscribed', data: { orderId } };
    }
    handleUnsubscribeFromOrder(client, orderId) {
        client.leave(`tracking:order:${orderId}`);
        this.logger.log(`Client ${client.id} unsubscribed from order tracking: ${orderId}`);
        return { event: 'unsubscribed', data: { orderId } };
    }
    handleDriverConnect(client, driverId) {
        this.driverSockets.set(driverId, client.id);
        client.join(`tracking:driver:${driverId}`);
        this.logger.log(`Driver ${driverId} connected for tracking`);
        return { event: 'connected', data: { driverId } };
    }
    async handleUpdateLocation(client, data) {
        try {
            await this.trackingService.updateDriverLocation(data.driverId, {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                speed: data.speed,
                heading: data.heading,
            });
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
        }
        catch (error) {
            this.logger.error(`Error updating location: ${error.message}`);
            return { event: 'error', data: { message: error.message } };
        }
    }
    emitDriverLocation(orderId, location) {
        this.server.to(`tracking:order:${orderId}`).emit('driverLocation', {
            orderId,
            ...location,
        });
        this.logger.debug(`Emitted driver location for order ${orderId}`);
    }
    emitDriverArrived(orderId, location) {
        this.server.to(`tracking:order:${orderId}`).emit('driverArrived', {
            orderId,
            location,
            timestamp: new Date(),
        });
        this.logger.log(`Driver arrived at ${location} for order ${orderId}`);
    }
    async handleGetOrderTracking(client, orderId) {
        try {
            const tracking = await this.trackingService.getOrderTracking(orderId);
            return { event: 'orderTracking', data: tracking };
        }
        catch (error) {
            return { event: 'error', data: { message: error.message } };
        }
    }
};
exports.TrackingGateway = TrackingGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], TrackingGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribeToOrder'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], TrackingGateway.prototype, "handleSubscribeToOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unsubscribeFromOrder'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], TrackingGateway.prototype, "handleUnsubscribeFromOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('driverConnect'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], TrackingGateway.prototype, "handleDriverConnect", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('updateLocation'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], TrackingGateway.prototype, "handleUpdateLocation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getOrderTracking'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], TrackingGateway.prototype, "handleGetOrderTracking", null);
exports.TrackingGateway = TrackingGateway = TrackingGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
            credentials: true,
        },
        namespace: '/tracking',
    }),
    __metadata("design:paramtypes", [tracking_service_1.TrackingService])
], TrackingGateway);
//# sourceMappingURL=tracking.gateway.js.map