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
var OrdersGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let OrdersGateway = OrdersGateway_1 = class OrdersGateway {
    constructor() {
        this.logger = new common_1.Logger(OrdersGateway_1.name);
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleJoinOrder(client, orderId) {
        client.join(`order:${orderId}`);
        this.logger.log(`Client ${client.id} joined order:${orderId}`);
        return { event: 'joined', data: { orderId } };
    }
    handleLeaveOrder(client, orderId) {
        client.leave(`order:${orderId}`);
        this.logger.log(`Client ${client.id} left order:${orderId}`);
        return { event: 'left', data: { orderId } };
    }
    handleJoinRestaurant(client, restaurantId) {
        client.join(`restaurant:${restaurantId}`);
        this.logger.log(`Client ${client.id} joined restaurant:${restaurantId}`);
        return { event: 'joined', data: { restaurantId } };
    }
    handleJoinDriver(client, driverId) {
        client.join(`driver:${driverId}`);
        client.join('drivers:available');
        this.logger.log(`Client ${client.id} joined driver:${driverId}`);
        return { event: 'joined', data: { driverId } };
    }
    emitOrderStatusUpdate(order) {
        this.server.to(`order:${order.id}`).emit('orderStatusUpdate', {
            orderId: order.id,
            status: order.status,
            order,
        });
        if (order.restaurantId) {
            this.server.to(`restaurant:${order.restaurantId}`).emit('orderStatusUpdate', {
                orderId: order.id,
                status: order.status,
                order,
            });
        }
        if (order.driverId) {
            this.server.to(`driver:${order.driverId}`).emit('orderStatusUpdate', {
                orderId: order.id,
                status: order.status,
                order,
            });
        }
        this.logger.log(`Emitted status update for order ${order.id}: ${order.status}`);
    }
    emitNewOrder(order) {
        if (order.restaurantId) {
            this.server.to(`restaurant:${order.restaurantId}`).emit('newOrder', {
                order,
            });
            this.logger.log(`Emitted new order to restaurant ${order.restaurantId}`);
        }
    }
    emitNewAvailableDelivery(order) {
        this.server.to('drivers:available').emit('newAvailableDelivery', {
            order,
        });
        this.logger.log(`Emitted new available delivery for order ${order.id}`);
    }
    emitDeliveryTaken(orderId) {
        this.server.to('drivers:available').emit('deliveryTaken', {
            orderId,
        });
        this.logger.log(`Emitted delivery taken for order ${orderId}`);
    }
};
exports.OrdersGateway = OrdersGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], OrdersGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinOrder'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveOrder'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleLeaveOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRestaurant'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinRestaurant", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinDriver'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinDriver", null);
exports.OrdersGateway = OrdersGateway = OrdersGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
            credentials: true,
        },
        namespace: '/orders',
    })
], OrdersGateway);
//# sourceMappingURL=orders.gateway.js.map