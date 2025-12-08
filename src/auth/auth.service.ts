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
import { GeocodingService } from '../geocoding/geocoding.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterRestaurantDto } from './dto/register-restaurant.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private geocodingService: GeocodingService,
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

    // Fetch full user data with customer info
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            cpf: true,
          },
        },
      },
    });

    return {
      user: fullUser,
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
                  cpf: registerDto.cpf,
                },
              }
            : undefined,
        // Create address if provided (without coordinates - will be geocoded async)
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

    // Geocode address asynchronously in background (fire and forget)
    if (user.addresses.length > 0) {
      this.geocodingService.geocodeAddressAsync(
        user.addresses[0].id,
        user.addresses[0].zipCode,
      );
    }

    return this.login({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async registerRestaurant(registerDto: RegisterRestaurantDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    // Create user and restaurant in a transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      // Create user
      const user = await prisma.user.create({
        data: {
          email: registerDto.email,
          passwordHash,
          phone: registerDto.phone,
          role: UserRole.RESTAURANT,
        },
      });

      // Create restaurant
      const slug = registerDto.restaurantName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      const restaurant = await prisma.restaurant.create({
        data: {
          name: registerDto.restaurantName,
          description: registerDto.description,
          slug,
          street: registerDto.street,
          number: registerDto.number,
          complement: registerDto.complement,
          neighborhood: registerDto.neighborhood,
          city: registerDto.city,
          state: registerDto.state,
          zipCode: registerDto.zipCode,
          deliveryRadius: 5,
          minOrderValue: 0,
          deliveryFee: 5.0,
          avgPrepTime: 30,
          isOpen: false,
        },
      });

      // Link user to restaurant
      await prisma.restaurantUser.create({
        data: {
          userId: user.id,
          restaurantId: restaurant.id,
          role: 'OWNER',
        },
      });

      // Link category if provided
      if (registerDto.category) {
        const category = await prisma.category.findFirst({
          where: { slug: registerDto.category.toLowerCase() },
        });

        if (category) {
          await prisma.restaurantCategory.create({
            data: {
              restaurantId: restaurant.id,
              categoryId: category.id,
            },
          });
        }
      }

      return { user, restaurant };
    });

    // Geocode restaurant address asynchronously
    this.geocodingService.geocodeRestaurantAsync(
      result.restaurant.id,
      registerDto.zipCode,
    );

    return this.login({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
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

    // Fetch full user data with customer info
    const fullUser = await this.prisma.user.findUnique({
      where: { id: tokenRecord.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            cpf: true,
          },
        },
      },
    });

    return {
      user: fullUser,
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
