import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '@prisma/client';
export declare class AuthService {
    private usersService;
    private jwtService;
    private prisma;
    private configService;
    constructor(usersService: UsersService, jwtService: JwtService, prisma: PrismaService, configService: ConfigService);
    validateUser(email: string, password: string): Promise<({
        customer: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            fullName: string;
            cpf: string | null;
            birthDate: Date | null;
        } | null;
    } & {
        phone: string | null;
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        emailVerified: boolean;
        phoneVerified: boolean;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    login(user: {
        id: string;
        email: string;
        role: UserRole;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    register(registerDto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    refreshTokens(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    logout(userId: string): Promise<{
        message: string;
    }>;
    private generateTokens;
    private saveRefreshToken;
}
