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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
            include: {
                customer: true,
            },
        });
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                customer: true,
                addresses: true,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async update(id, updateUserDto) {
        const user = await this.findById(id);
        return this.prisma.user.update({
            where: { id: user.id },
            data: {
                phone: updateUserDto.phone,
                customer: user.customer
                    ? {
                        update: {
                            fullName: updateUserDto.name,
                        },
                    }
                    : undefined,
            },
            include: {
                customer: true,
            },
        });
    }
    async getProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        cpf: true,
                    },
                },
                addresses: {
                    orderBy: { isDefault: 'desc' },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async getAddresses(userId) {
        return this.prisma.address.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' },
        });
    }
    async createAddress(userId, createAddressDto) {
        if (createAddressDto.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }
        const existingAddresses = await this.prisma.address.count({
            where: { userId },
        });
        return this.prisma.address.create({
            data: {
                userId,
                street: createAddressDto.street,
                number: createAddressDto.number,
                complement: createAddressDto.complement,
                neighborhood: createAddressDto.neighborhood,
                city: createAddressDto.city,
                state: createAddressDto.state,
                zipCode: createAddressDto.zipCode,
                latitude: createAddressDto.latitude,
                longitude: createAddressDto.longitude,
                isDefault: createAddressDto.isDefault || existingAddresses === 0,
            },
        });
    }
    async updateAddress(userId, addressId, updateAddressDto) {
        const address = await this.prisma.address.findFirst({
            where: { id: addressId, userId },
        });
        if (!address) {
            throw new common_1.NotFoundException('Address not found');
        }
        if (updateAddressDto.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId, id: { not: addressId } },
                data: { isDefault: false },
            });
        }
        return this.prisma.address.update({
            where: { id: addressId },
            data: {
                street: updateAddressDto.street,
                number: updateAddressDto.number,
                complement: updateAddressDto.complement,
                neighborhood: updateAddressDto.neighborhood,
                city: updateAddressDto.city,
                state: updateAddressDto.state,
                zipCode: updateAddressDto.zipCode,
                latitude: updateAddressDto.latitude,
                longitude: updateAddressDto.longitude,
                isDefault: updateAddressDto.isDefault,
            },
        });
    }
    async deleteAddress(userId, addressId) {
        const address = await this.prisma.address.findFirst({
            where: { id: addressId, userId },
        });
        if (!address) {
            throw new common_1.NotFoundException('Address not found');
        }
        await this.prisma.address.delete({
            where: { id: addressId },
        });
        if (address.isDefault) {
            const firstAddress = await this.prisma.address.findFirst({
                where: { userId },
            });
            if (firstAddress) {
                await this.prisma.address.update({
                    where: { id: firstAddress.id },
                    data: { isDefault: true },
                });
            }
        }
        return { message: 'Address deleted successfully' };
    }
    async setDefaultAddress(userId, addressId) {
        const address = await this.prisma.address.findFirst({
            where: { id: addressId, userId },
        });
        if (!address) {
            throw new common_1.NotFoundException('Address not found');
        }
        await this.prisma.address.updateMany({
            where: { userId },
            data: { isDefault: false },
        });
        return this.prisma.address.update({
            where: { id: addressId },
            data: { isDefault: true },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map