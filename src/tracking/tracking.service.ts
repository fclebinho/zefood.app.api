import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async updateDriverLocation(driverId: string, location: LocationUpdate) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Update current location on driver record
    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        currentLat: location.latitude,
        currentLng: location.longitude,
        lastLocationAt: new Date(),
      },
    });

    // Save location history
    await this.prisma.driverLocation.create({
      data: {
        driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
      },
    });

    return {
      driverId,
      latitude: location.latitude,
      longitude: location.longitude,
      updatedAt: new Date(),
    };
  }

  async getDriverLocation(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        fullName: true,
        currentLat: true,
        currentLng: true,
        lastLocationAt: true,
        vehicleType: true,
        vehiclePlate: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return {
      driverId: driver.id,
      name: driver.fullName,
      latitude: driver.currentLat ? Number(driver.currentLat) : null,
      longitude: driver.currentLng ? Number(driver.currentLng) : null,
      lastUpdate: driver.lastLocationAt,
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate,
    };
  }

  async getOrderTracking(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            currentLat: true,
            currentLng: true,
            lastLocationAt: true,
            vehicleType: true,
            vehiclePlate: true,
            user: {
              select: {
                phone: true,
              },
            },
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            street: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Get delivery address
    const deliveryAddress = order.deliveryAddress as any;

    return {
      orderId: order.id,
      status: order.status,
      driver: order.driver
        ? {
            id: order.driver.id,
            name: order.driver.fullName,
            phone: order.driver.user?.phone,
            vehicleType: order.driver.vehicleType,
            vehiclePlate: order.driver.vehiclePlate,
            location: order.driver.currentLat
              ? {
                  latitude: Number(order.driver.currentLat),
                  longitude: Number(order.driver.currentLng),
                  lastUpdate: order.driver.lastLocationAt,
                }
              : null,
          }
        : null,
      restaurant: {
        id: order.restaurant.id,
        name: order.restaurant.name,
        address: `${order.restaurant.street}, ${order.restaurant.number} - ${order.restaurant.neighborhood}`,
        latitude: order.restaurant.latitude ? Number(order.restaurant.latitude) : null,
        longitude: order.restaurant.longitude ? Number(order.restaurant.longitude) : null,
      },
      deliveryAddress: deliveryAddress
        ? {
            street: deliveryAddress.street,
            number: deliveryAddress.number,
            complement: deliveryAddress.complement,
            neighborhood: deliveryAddress.neighborhood,
            city: deliveryAddress.city,
            state: deliveryAddress.state,
            latitude: deliveryAddress.latitude,
            longitude: deliveryAddress.longitude,
          }
        : null,
      estimatedDelivery: order.estimatedDeliveryAt,
    };
  }

  async getActiveDeliveryForDriver(driverId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        driverId,
        status: {
          in: ['PICKED_UP', 'IN_TRANSIT'],
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            street: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    const deliveryAddress = order.deliveryAddress as any;

    return {
      orderId: order.id,
      status: order.status,
      customer: {
        id: order.customer.id,
        name: order.customer.fullName,
      },
      restaurant: {
        id: order.restaurant.id,
        name: order.restaurant.name,
        address: `${order.restaurant.street}, ${order.restaurant.number}`,
        latitude: order.restaurant.latitude ? Number(order.restaurant.latitude) : null,
        longitude: order.restaurant.longitude ? Number(order.restaurant.longitude) : null,
      },
      deliveryAddress: deliveryAddress
        ? {
            street: deliveryAddress.street,
            number: deliveryAddress.number,
            complement: deliveryAddress.complement,
            neighborhood: deliveryAddress.neighborhood,
            city: deliveryAddress.city,
            state: deliveryAddress.state,
            latitude: deliveryAddress.latitude,
            longitude: deliveryAddress.longitude,
          }
        : null,
    };
  }
}
