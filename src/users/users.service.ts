import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private geocodingService: GeocodingService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        customer: true,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        customer: true,
        addresses: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id);

    const fullName = updateUserDto.fullName || updateUserDto.name;

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        phone: updateUserDto.phone,
        customer:
          user.customer && fullName
            ? {
                update: {
                  fullName,
                },
              }
            : undefined,
      },
      include: {
        customer: true,
      },
    });
  }

  async getProfile(userId: string) {
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
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async createAddress(userId: string, createAddressDto: CreateAddressDto) {
    // If this is the first address or marked as default, update other addresses
    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    // Check if this is the first address for the user
    const existingAddresses = await this.prisma.address.count({
      where: { userId },
    });

    // Create address immediately without coordinates
    const address = await this.prisma.address.create({
      data: {
        userId,
        street: createAddressDto.street,
        number: createAddressDto.number,
        complement: createAddressDto.complement,
        neighborhood: createAddressDto.neighborhood,
        city: createAddressDto.city,
        state: createAddressDto.state,
        zipCode: createAddressDto.zipCode,
        isDefault: createAddressDto.isDefault || existingAddresses === 0,
      },
    });

    // Geocode asynchronously in background (fire and forget)
    this.geocodingService.geocodeAddressAsync(address.id, createAddressDto.zipCode);

    return address;
  }

  async updateAddress(userId: string, addressId: string, updateAddressDto: CreateAddressDto) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (updateAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    // Update address immediately without coordinates
    const updatedAddress = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        street: updateAddressDto.street,
        number: updateAddressDto.number,
        complement: updateAddressDto.complement,
        neighborhood: updateAddressDto.neighborhood,
        city: updateAddressDto.city,
        state: updateAddressDto.state,
        zipCode: updateAddressDto.zipCode,
        latitude: null,
        longitude: null,
        isDefault: updateAddressDto.isDefault,
      },
    });

    // Geocode asynchronously in background (fire and forget)
    this.geocodingService.geocodeAddressAsync(addressId, updateAddressDto.zipCode);

    return updatedAddress;
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    // If deleted address was default, set another as default
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

  async setDefaultAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
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
}
