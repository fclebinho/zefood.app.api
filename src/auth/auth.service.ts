import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
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

  async login(user: { id: string; email: string; role: UserRole }) {
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

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash,
        phone: registerDto.phone,
        role: registerDto.role || UserRole.CUSTOMER,
        customer:
          registerDto.role === UserRole.CUSTOMER || !registerDto.role
            ? {
                create: {
                  fullName: registerDto.name,
                },
              }
            : undefined,
        // Create address if provided
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

  async refreshTokens(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });
      throw new UnauthorizedException('Refresh token expired');
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

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: UserRole;
  }) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'refresh-secret-key',
      expiresIn: 604800, // 7 days in seconds
    });

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string) {
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
}
