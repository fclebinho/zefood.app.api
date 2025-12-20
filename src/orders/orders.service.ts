import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersGateway } from '../websocket/orders.gateway';
import { TrackingGateway } from '../tracking/tracking.gateway';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
    private trackingGateway: TrackingGateway,
  ) {}

  async create(customerId: string, createOrderDto: CreateOrderDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: createOrderDto.restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    if (!restaurant.isOpen) {
      throw new BadRequestException('Restaurant is closed');
    }

    // Get delivery address - either from addressId or inline deliveryAddress
    let deliveryAddressData: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      zipCode: string;
      latitude?: number;
      longitude?: number;
    };

    if (createOrderDto.addressId) {
      const address = await this.prisma.address.findFirst({
        where: {
          id: createOrderDto.addressId,
          userId: customerId,
        },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      deliveryAddressData = {
        street: address.street,
        number: address.number,
        complement: address.complement || undefined,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        latitude: address.latitude?.toNumber(),
        longitude: address.longitude?.toNumber(),
      };
    } else if (createOrderDto.deliveryAddress) {
      deliveryAddressData = {
        street: createOrderDto.deliveryAddress.street,
        number: createOrderDto.deliveryAddress.number,
        complement: createOrderDto.deliveryAddress.complement,
        neighborhood: createOrderDto.deliveryAddress.neighborhood,
        city: createOrderDto.deliveryAddress.city,
        state: createOrderDto.deliveryAddress.state,
        zipCode: createOrderDto.deliveryAddress.zipCode,
      };
    } else {
      throw new BadRequestException('Delivery address is required');
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: createOrderDto.items.map((i) => i.menuItemId) },
      },
      include: {
        category: {
          include: {
            restaurant: true,
          },
        },
      },
    });

    // Verify all items belong to the same restaurant
    const invalidItems = menuItems.filter(
      (item) => item.category.restaurant.id !== restaurant.id,
    );
    if (invalidItems.length > 0 || menuItems.length !== createOrderDto.items.length) {
      throw new BadRequestException('Invalid menu items');
    }

    let subtotal = 0;
    const orderItems = createOrderDto.items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId);
      if (!menuItem) {
        throw new BadRequestException(`Menu item ${item.menuItemId} not found`);
      }
      const itemTotal = menuItem.price.toNumber() * item.quantity;
      subtotal += itemTotal;
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        totalPrice: itemTotal,
        notes: item.notes,
      };
    });

    // Validate minimum order value (based on subtotal, not including delivery fee)
    const minOrderValue = restaurant.minOrderValue?.toNumber() || 0;
    if (minOrderValue > 0 && subtotal < minOrderValue) {
      throw new BadRequestException(
        `Pedido mínimo de R$ ${minOrderValue.toFixed(2).replace('.', ',')}. Seu pedido: R$ ${subtotal.toFixed(2).replace('.', ',')}`,
      );
    }

    const deliveryFee = restaurant.deliveryFee.toNumber();
    const total = subtotal + deliveryFee;

    const order = await this.prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        deliveryAddress: deliveryAddressData,
        status: OrderStatus.PENDING,
        subtotal,
        deliveryFee,
        discount: 0,
        total,
        paymentMethod: createOrderDto.paymentMethod as PaymentMethod,
        notes: createOrderDto.notes,
        items: {
          create: orderItems,
        },
        statusHistory: {
          create: {
            status: OrderStatus.PENDING,
          },
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        restaurant: true,
      },
    });

    // Note: WebSocket notification is now sent after payment confirmation
    // See PaymentsService.processPayment for the emission logic

    return order;
  }

  async findByCustomer(customerId: string, page = 1, limit = 10) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: customer.id },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          items: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where: { customerId: customer.id } }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            user: {
              select: { id: true },
            },
          },
        },
        restaurant: true,
        driver: true,
        items: {
          include: {
            menuItem: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customer.user.id !== userId) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    userId: string,
    _role: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          include: {
            users: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.REJECTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
      [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REJECTED]: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        statusHistory: {
          create: {
            status,
            createdBy: userId,
          },
        },
      },
      include: {
        items: true,
        restaurant: true,
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
        driver: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Emit WebSocket event for status update
    this.ordersGateway.emitOrderStatusUpdate(updatedOrder);
    // Also emit to tracking namespace for real-time tracking screen
    this.trackingGateway.emitOrderStatusUpdate(updatedOrder);

    // If order is READY, notify available drivers
    if (status === OrderStatus.READY && !updatedOrder.driverId) {
      this.ordersGateway.emitNewAvailableDelivery(updatedOrder);
    }

    return updatedOrder;
  }
}
