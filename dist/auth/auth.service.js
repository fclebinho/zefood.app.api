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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    constructor(usersService, jwtService, prisma, configService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.configService = configService;
    }
    async validateUser(email, password) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return null;
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return null;
        }
        return user;
    }
    async login(user) {
        const tokens = await this.generateTokens(user);
        await this.saveRefreshToken(user.id, tokens.refreshToken);
        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            ...tokens,
        };
    }
    async register(registerDto) {
        const existingUser = await this.usersService.findByEmail(registerDto.email);
        if (existingUser) {
            throw new common_1.ConflictException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(registerDto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                email: registerDto.email,
                passwordHash,
                phone: registerDto.phone,
                role: registerDto.role || client_1.UserRole.CUSTOMER,
                customer: registerDto.role === client_1.UserRole.CUSTOMER || !registerDto.role
                    ? {
                        create: {
                            fullName: registerDto.name,
                        },
                    }
                    : undefined,
                addresses: registerDto.address
                    ? {
                        create: {
                            street: registerDto.address.street,
                            number: registerDto.address.number,
                            complement: registerDto.address.complement,
                            neighborhood: registerDto.address.neighborhood,
                            city: registerDto.address.city,
                            state: registerDto.address.state,
                            zipCode: registerDto.address.zipCode,
                            latitude: registerDto.address.latitude,
                            longitude: registerDto.address.longitude,
                            isDefault: true,
                        },
                    }
                    : undefined,
            },
            include: {
                customer: true,
                addresses: true,
            },
        });
        return this.login({
            id: user.id,
            email: user.email,
            role: user.role,
        });
    }
    async refreshTokens(refreshToken) {
        const tokenRecord = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!tokenRecord) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        if (tokenRecord.expiresAt < new Date()) {
            await this.prisma.refreshToken.delete({
                where: { id: tokenRecord.id },
            });
            throw new common_1.UnauthorizedException('Refresh token expired');
        }
        await this.prisma.refreshToken.delete({
            where: { id: tokenRecord.id },
        });
        const tokens = await this.generateTokens(tokenRecord.user);
        await this.saveRefreshToken(tokenRecord.user.id, tokens.refreshToken);
        return {
            user: {
                id: tokenRecord.user.id,
                email: tokenRecord.user.email,
                role: tokenRecord.user.role,
            },
            ...tokens,
        };
    }
    async logout(userId) {
        await this.prisma.refreshToken.deleteMany({
            where: { userId },
        });
        return { message: 'Logged out successfully' };
    }
    async generateTokens(user) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET') ||
                'refresh-secret-key',
            expiresIn: 604800,
        });
        return { accessToken, refreshToken };
    }
    async saveRefreshToken(userId, token) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await this.prisma.refreshToken.create({
            data: {
                userId,
                token,
                expiresAt,
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        prisma_service_1.PrismaService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map