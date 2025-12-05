import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverStatus, OrderStatus } from '@prisma/client';
import { OrdersGateway } from '../websocket/orders.gateway';

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
  ) {}

  async getProfile(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  async updateStatus(userId: string, isOnline: boolean) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return this.prisma.driver.update({
      where: { id: driver.id },
      data: { isOnline },
    });
  }

  async updateLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Update driver's current location
    await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        currentLat: latitude,
        currentLng: longitude,
        lastLocationAt: new Date(),
      },
    });

    // Also save to location history
    await this.prisma.driverLocation.create({
      data: {
        driverId: driver.id,
        latitude,
        longitude,
      },
    });

    return { success: true };
  }

  async getAvailableDeliveries(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.READY,
        driverId: null,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            phone: true,
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
            fullName: true,
            user: {
              select: {
                phone: true,
              },
            },
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    return orders;
  }

  async acceptDelivery(userId: string, orderId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (!driver.isOnline) {
      throw new BadRequestException('Driver is not online');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.READY) {
      throw new BadRequestException('Order is not ready for pickup');
    }

    if (order.driverId) {
      throw new BadRequestException('Order already has a driver');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: driver.id,
        status: OrderStatus.PICKED_UP,
        pickedUpAt: new Date(),
        statusHistory: {
          create: {
            status: OrderStatus.PICKED_UP,
            createdBy: userId,
          },
        },
      },
      include: {
        restaurant: true,
        customer: {
          include: {
            user: {
              select: {
                phone: true,
              },
            },
          },
        },
      },
    });

    // Emit WebSocket events
    this.ordersGateway.emitOrderStatusUpdate(updatedOrder);
    this.ordersGateway.emitDeliveryTaken(orderId);

    return updatedOrder;
  }

  async getCurrentDelivery(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
          ],
        },
      },
      include: {
        restaurant: true,
        customer: {
          select: {
            fullName: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return order;
  }

  async getDeliveryHistory(userId: string, page = 1, limit = 10) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          driverId: driver.id,
          status: OrderStatus.DELIVERED,
        },
        include: {
          restaurant: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { deliveredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({
        where: {
          driverId: driver.id,
          status: OrderStatus.DELIVERED,
        },
      }),
    ]);

    return {
      data: deliveries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEarnings(userId: string, startDate?: Date, endDate?: Date) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const where = {
      driverId: driver.id,
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const earnings = await this.prisma.driverEarning.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const totalEarnings = earnings.reduce(
      (sum, e) => sum + e.amount.toNumber(),
      0,
    );
    const totalDeliveries = earnings.filter(e => e.type === 'DELIVERY').length;

    return {
      earnings,
      summary: {
        totalEarnings,
        totalDeliveries,
        averagePerDelivery:
          totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0,
      },
    };
  }
}
