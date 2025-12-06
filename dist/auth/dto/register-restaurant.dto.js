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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterRestaurantDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class RegisterRestaurantDto {
}
exports.RegisterRestaurantDto = RegisterRestaurantDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'restaurante@example.com', description: 'Email do proprietário' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RegisterRestaurantDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'senha123', description: 'Senha', minLength: 6 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    __metadata("design:type", String)
], RegisterRestaurantDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'João Silva', description: 'Nome do proprietário' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterRestaurantDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '11999999999', description: 'Telefone' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterRestaurantDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Pizzaria do João', description: 'Nome do restaurante' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterRestaurantDto.prototype, "restaurantName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'A melhor pizza da cidade', description: 'Descrição' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterRestaurantDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Pizzaria', description: 'Categoria do restaurante' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterRestaurantDto.prototype, "category", void 0);
//# sourceMappingURL=register-restaurant.dto.js.map