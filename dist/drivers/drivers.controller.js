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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriversController = void 0;
const common_1 = require("@nestjs/common");
const drivers_service_1 = require("./drivers.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
const update_location_dto_1 = require("./dto/update-location.dto");
let DriversController = class DriversController {
    constructor(driversService) {
        this.driversService = driversService;
    }
    async getProfile(userId) {
        return this.driversService.getProfile(userId);
    }
    async updateStatus(userId, isOnline) {
        return this.driversService.updateStatus(userId, isOnline);
    }
    async updateLocation(userId, updateLocationDto) {
        return this.driversService.updateLocation(userId, updateLocationDto.latitude, updateLocationDto.longitude);
    }
    async getAvailableDeliveries(userId) {
        return this.driversService.getAvailableDeliveries(userId);
    }
    async acceptDelivery(userId, orderId) {
        return this.driversService.acceptDelivery(userId, orderId);
    }
    async getCurrentDelivery(userId) {
        return this.driversService.getCurrentDelivery(userId);
    }
    async getDeliveryHistory(userId, page, limit) {
        return this.driversService.getDeliveryHistory(userId, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 10);
    }
    async getEarnings(userId, startDate, endDate) {
        return this.driversService.getEarnings(userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
    }
};
exports.DriversController = DriversController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)('isOnline')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)('location'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_location_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Get)('deliveries/available'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "getAvailableDeliveries", null);
__decorate([
    (0, common_1.Post)('deliveries/:orderId/accept'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "acceptDelivery", null);
__decorate([
    (0, common_1.Get)('deliveries/current'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "getCurrentDelivery", null);
__decorate([
    (0, common_1.Get)('deliveries/history'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "getDeliveryHistory", null);
__decorate([
    (0, common_1.Get)('earnings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DriversController.prototype, "getEarnings", null);
exports.DriversController = DriversController = __decorate([
    (0, common_1.Controller)('drivers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.DRIVER),
    __metadata("design:paramtypes", [drivers_service_1.DriversService])
], DriversController);
//# sourceMappingURL=drivers.controller.js.map