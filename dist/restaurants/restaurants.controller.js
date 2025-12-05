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
exports.RestaurantsController = void 0;
const common_1 = require("@nestjs/common");
const restaurants_service_1 = require("./restaurants.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const menu_item_dto_1 = require("./dto/menu-item.dto");
const menu_category_dto_1 = require("./dto/menu-category.dto");
const restaurant_settings_dto_1 = require("./dto/restaurant-settings.dto");
let RestaurantsController = class RestaurantsController {
    constructor(restaurantsService) {
        this.restaurantsService = restaurantsService;
    }
    async findAll(categoryId, search, latitude, longitude, page, limit) {
        return this.restaurantsService.findAll({
            categoryId,
            search,
            latitude: latitude ? parseFloat(latitude) : undefined,
            longitude: longitude ? parseFloat(longitude) : undefined,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
    }
    async getCategories() {
        return this.restaurantsService.getCategories();
    }
    async findBySlug(slug) {
        return this.restaurantsService.findBySlug(slug);
    }
    async getMenu(id) {
        return this.restaurantsService.getMenu(id);
    }
    async getMyRestaurant(userId) {
        return this.restaurantsService.getRestaurantByUserId(userId);
    }
    async updateSettings(userId, updateSettingsDto) {
        return this.restaurantsService.updateSettings(userId, updateSettingsDto);
    }
    async toggleOnlineStatus(userId) {
        return this.restaurantsService.toggleOnlineStatus(userId);
    }
    async getMyOrders(userId, status, page, limit) {
        return this.restaurantsService.getRestaurantOrders(userId, {
            status,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 50,
        });
    }
    async getMyMenuCategories(userId) {
        return this.restaurantsService.getMenuCategories(userId);
    }
    async createMenuCategory(userId, createDto) {
        return this.restaurantsService.createMenuCategory(userId, createDto);
    }
    async updateMenuCategory(userId, categoryId, updateDto) {
        return this.restaurantsService.updateMenuCategory(userId, categoryId, updateDto);
    }
    async deleteMenuCategory(userId, categoryId) {
        return this.restaurantsService.deleteMenuCategory(userId, categoryId);
    }
    async getMyMenuItems(userId, categoryId) {
        return this.restaurantsService.getMenuItems(userId, categoryId);
    }
    async createMenuItem(userId, createDto) {
        return this.restaurantsService.createMenuItem(userId, createDto);
    }
    async updateMenuItem(userId, itemId, updateDto) {
        return this.restaurantsService.updateMenuItem(userId, itemId, updateDto);
    }
    async toggleMenuItemAvailability(userId, itemId) {
        return this.restaurantsService.toggleMenuItemAvailability(userId, itemId);
    }
    async deleteMenuItem(userId, itemId) {
        return this.restaurantsService.deleteMenuItem(userId, itemId);
    }
};
exports.RestaurantsController = RestaurantsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('latitude')),
    __param(3, (0, common_1.Query)('longitude')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "findBySlug", null);
__decorate([
    (0, common_1.Get)(':id/menu'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "getMenu", null);
__decorate([
    (0, common_1.Get)('my/profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "getMyRestaurant", null);
__decorate([
    (0, common_1.Patch)('my/settings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, restaurant_settings_dto_1.UpdateRestaurantSettingsDto]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Patch)('my/toggle-status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "toggleOnlineStatus", null);
__decorate([
    (0, common_1.Get)('my/orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "getMyOrders", null);
__decorate([
    (0, common_1.Get)('my/menu-categories'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "getMyMenuCategories", null);
__decorate([
    (0, common_1.Post)('my/menu-categories'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, menu_category_dto_1.CreateMenuCategoryDto]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "createMenuCategory", null);
__decorate([
    (0, common_1.Patch)('my/menu-categories/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, menu_category_dto_1.UpdateMenuCategoryDto]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "updateMenuCategory", null);
__decorate([
    (0, common_1.Delete)('my/menu-categories/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "deleteMenuCategory", null);
__decorate([
    (0, common_1.Get)('my/menu-items'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "getMyMenuItems", null);
__decorate([
    (0, common_1.Post)('my/menu-items'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, menu_item_dto_1.CreateMenuItemDto]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "createMenuItem", null);
__decorate([
    (0, common_1.Patch)('my/menu-items/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, menu_item_dto_1.UpdateMenuItemDto]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "updateMenuItem", null);
__decorate([
    (0, common_1.Patch)('my/menu-items/:id/toggle'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "toggleMenuItemAvailability", null);
__decorate([
    (0, common_1.Delete)('my/menu-items/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('RESTAURANT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RestaurantsController.prototype, "deleteMenuItem", null);
exports.RestaurantsController = RestaurantsController = __decorate([
    (0, common_1.Controller)('restaurants'),
    __metadata("design:paramtypes", [restaurants_service_1.RestaurantsService])
], RestaurantsController);
//# sourceMappingURL=restaurants.controller.js.map