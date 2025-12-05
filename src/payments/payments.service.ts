import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface CreatePaymentDto {
  orderId: string;
  method: PaymentMethod;
  // For card payments
  cardToken?: string;
  // For saved cards
  savedCardId?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  status: PaymentStatus;
  redirectUrl?: string;
  pixQrCode?: string;
  pixCode?: string;
  error?: string;
}

export interface PixPaymentData {
  qrCode: string;
  qrCodeBase64: string;
  copyPasteCode: string;
  expiresAt: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;
  private mercadopago: MercadoPagoConfig | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize Stripe
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
      this.logger.log('Stripe initialized');
    }

    // Initialize MercadoPago
    const mpAccessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (mpAccessToken) {
      this.mercadopago = new MercadoPagoConfig({
        accessToken: mpAccessToken,
      });
      this.logger.log('MercadoPago initialized');
    }
  }

  getAvailablePaymentMethods() {
    const methods = [
      { value: 'PIX', label: 'Pix', icon: '💠', available: true },
      { value: 'CASH', label: 'Dinheiro', icon: '💵', available: true },
      {
        value: 'CREDIT_CARD',
        label: 'Cartão de crédito',
        icon: '💳',
        available: !!(this.stripe || this.mercadopago),
      },
      {
        value: 'DEBIT_CARD',
        label: 'Cartão de débito',
        icon: '💳',
        available: !!(this.stripe || this.mercadopago),
      },
    ];

    return {
      methods,
      hasCardPayment: !!(this.stripe || this.mercadopago),
    };
  }

  async processPayment(dto: CreatePaymentDto, userId: string): Promise<PaymentResult> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        customer: { userId },
      },
      include: {
        restaurant: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Order already paid');
    }

    const amount = Number(order.total);

    switch (dto.method) {
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
        return this.processCardPayment(order, dto, amount);
      case PaymentMethod.PIX:
        return this.processPixPayment(order, amount);
      case PaymentMethod.CASH:
        return this.processCashPayment(order);
      default:
        throw new BadRequestException('Invalid payment method');
    }
  }

  private async processCardPayment(
    order: any,
    dto: CreatePaymentDto,
    amount: number,
  ): Promise<PaymentResult> {
    // Try MercadoPago first (better for Brazilian cards)
    if (this.mercadopago && dto.cardToken) {
      try {
        const payment = new Payment(this.mercadopago);
        const result = await payment.create({
          body: {
            transaction_amount: amount,
            token: dto.cardToken,
            description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
            installments: 1,
            payment_method_id: dto.method === PaymentMethod.CREDIT_CARD ? 'master' : 'debmaster',
            payer: {
              email: order.customer?.user?.email || 'customer@zefood.com',
            },
            metadata: {
              order_id: order.id,
            },
          },
        });

        const status = this.mapMercadoPagoStatus(result.status);

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            paymentId: result.id?.toString(),
            paymentStatus: status,
            paymentMethod: dto.method,
          },
        });

        return {
          success: status === PaymentStatus.PAID,
          paymentId: result.id?.toString(),
          status,
        };
      } catch (error) {
        this.logger.error('MercadoPago card payment error:', error);
      }
    }

    // Fallback to Stripe
    if (this.stripe && dto.cardToken) {
      try {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Stripe uses cents
          currency: 'brl',
          payment_method: dto.cardToken,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
          metadata: {
            orderId: order.id,
          },
        });

        const status = this.mapStripeStatus(paymentIntent.status);

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            paymentId: paymentIntent.id,
            paymentStatus: status,
            paymentMethod: dto.method,
          },
        });

        return {
          success: status === PaymentStatus.PAID,
          paymentId: paymentIntent.id,
          status,
          redirectUrl: paymentIntent.next_action?.redirect_to_url?.url || undefined,
        };
      } catch (error) {
        this.logger.error('Stripe card payment error:', error);
        throw new BadRequestException('Payment failed');
      }
    }

    // No payment gateway configured - reject card payments
    this.logger.warn('No payment gateway configured for card payments');
    throw new BadRequestException(
      'Pagamento com cartão não disponível no momento. Por favor, escolha Pix ou Dinheiro.',
    );
  }

  private async processPixPayment(order: any, amount: number): Promise<PaymentResult> {
    // Try MercadoPago Pix
    if (this.mercadopago) {
      try {
        const payment = new Payment(this.mercadopago);
        const result = await payment.create({
          body: {
            transaction_amount: amount,
            description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
            payment_method_id: 'pix',
            payer: {
              email: order.customer?.user?.email || 'customer@zefood.com',
            },
            metadata: {
              order_id: order.id,
            },
          },
        });

        const pixData = result.point_of_interaction?.transaction_data;

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            paymentId: result.id?.toString(),
            paymentStatus: PaymentStatus.PENDING,
            paymentMethod: PaymentMethod.PIX,
          },
        });

        return {
          success: true,
          paymentId: result.id?.toString(),
          status: PaymentStatus.PENDING,
          pixQrCode: pixData?.qr_code_base64,
          pixCode: pixData?.qr_code,
        };
      } catch (error) {
        this.logger.error('MercadoPago Pix error:', error);
      }
    }

    // Fallback: Generate mock Pix QR Code for development
    const pixData = await this.generateMockPixCode(order, amount);

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: `pix_${Date.now()}`,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.PIX,
      },
    });

    return {
      success: true,
      paymentId: `pix_${Date.now()}`,
      status: PaymentStatus.PENDING,
      pixQrCode: pixData.qrCodeBase64,
      pixCode: pixData.copyPasteCode,
    };
  }

  private async processCashPayment(order: any): Promise<PaymentResult> {
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.CASH,
      },
    });

    return {
      success: true,
      status: PaymentStatus.PENDING,
    };
  }

  private async generateMockPixCode(order: any, amount: number): Promise<PixPaymentData> {
    // Generate a mock Pix code for development
    // In production, this would come from a real payment provider
    const pixKey = this.configService.get<string>('PIX_KEY') || 'zefood@pix.com';
    const merchantName = order.restaurant.name.substring(0, 25);
    const city = order.restaurant.city.substring(0, 15);
    const txId = order.id.replace(/-/g, '').substring(0, 25);

    // Generate EMV QR Code format for Pix
    const pixPayload = this.generatePixPayload({
      pixKey,
      merchantName,
      city,
      amount,
      txId,
    });

    const qrCodeBase64 = await QRCode.toDataURL(pixPayload, {
      type: 'image/png',
      width: 300,
      margin: 2,
    });

    return {
      qrCode: pixPayload,
      qrCodeBase64,
      copyPasteCode: pixPayload,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  private generatePixPayload(data: {
    pixKey: string;
    merchantName: string;
    city: string;
    amount: number;
    txId: string;
  }): string {
    // EMV QR Code format for Pix
    const formatField = (id: string, value: string) => {
      const len = value.length.toString().padStart(2, '0');
      return `${id}${len}${value}`;
    };

    // Merchant Account Information (26)
    const gui = formatField('00', 'br.gov.bcb.pix');
    const key = formatField('01', data.pixKey);
    const merchantAccount = formatField('26', gui + key);

    // Merchant Category Code
    const mcc = formatField('52', '0000');

    // Transaction Currency (986 = BRL)
    const currency = formatField('53', '986');

    // Transaction Amount
    const amount = formatField('54', data.amount.toFixed(2));

    // Country Code
    const country = formatField('58', 'BR');

    // Merchant Name
    const merchantName = formatField('59', data.merchantName);

    // Merchant City
    const city = formatField('60', data.city);

    // Additional Data Field Template (62)
    const txId = formatField('05', data.txId);
    const additionalData = formatField('62', txId);

    // Payload Format Indicator
    const payloadFormat = formatField('00', '01');

    // Build payload without CRC
    const payloadWithoutCRC = payloadFormat + merchantAccount + mcc + currency + amount + country + merchantName + city + additionalData + '6304';

    // Calculate CRC16
    const crc = this.calculateCRC16(payloadWithoutCRC);

    return payloadWithoutCRC + crc;
  }

  private calculateCRC16(payload: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc <<= 1;
        }
        crc &= 0xFFFF;
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Stripe Payment Intent creation for frontend
  async createStripePaymentIntent(orderId: string, userId: string): Promise<{ clientSecret: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customer: { userId },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const amount = Math.round(Number(order.total) * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: 'brl',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId: order.id,
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: paymentIntent.id,
      },
    });

    return { clientSecret: paymentIntent.client_secret! };
  }

  // MercadoPago Preference creation for Checkout Pro
  async createMercadoPagoPreference(orderId: string, userId: string): Promise<{ preferenceId: string; initPoint: string }> {
    if (!this.mercadopago) {
      throw new BadRequestException('MercadoPago not configured');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customer: { userId },
      },
      include: {
        restaurant: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const preference = new Preference(this.mercadopago);
    const baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    const result = await preference.create({
      body: {
        items: order.items.map(item => ({
          id: item.id,
          title: item.menuItem.name,
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          currency_id: 'BRL',
        })),
        back_urls: {
          success: `${baseUrl}/customer/orders/${order.id}?payment=success`,
          failure: `${baseUrl}/customer/orders/${order.id}?payment=failure`,
          pending: `${baseUrl}/customer/orders/${order.id}?payment=pending`,
        },
        auto_return: 'approved',
        external_reference: order.id,
        notification_url: `${baseUrl}/api/payments/webhook/mercadopago`,
      },
    });

    return {
      preferenceId: result.id!,
      initPoint: result.init_point!,
    };
  }

  // Webhook handlers
  async handleStripeWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!this.stripe) return;

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('Stripe webhook secret not configured');
      return;
    }

    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
      }
    } catch (error) {
      this.logger.error('Stripe webhook error:', error);
      throw new BadRequestException('Webhook signature verification failed');
    }
  }

  async handleMercadoPagoWebhook(data: any): Promise<void> {
    if (!this.mercadopago) return;

    try {
      if (data.type === 'payment') {
        const payment = new Payment(this.mercadopago);
        const paymentData = await payment.get({ id: data.data.id });

        const orderId = paymentData.metadata?.order_id || paymentData.external_reference;
        if (!orderId) return;

        const status = this.mapMercadoPagoStatus(paymentData.status);

        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: status,
          },
        });

        this.logger.log(`MercadoPago payment ${data.data.id} status: ${status}`);
      }
    } catch (error) {
      this.logger.error('MercadoPago webhook error:', error);
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) return;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
      },
    });

    this.logger.log(`Stripe payment ${paymentIntent.id} succeeded for order ${orderId}`);
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) return;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.FAILED,
      },
    });

    this.logger.log(`Stripe payment ${paymentIntent.id} failed for order ${orderId}`);
  }

  private mapStripeStatus(status: string): PaymentStatus {
    switch (status) {
      case 'succeeded':
        return PaymentStatus.PAID;
      case 'canceled':
        return PaymentStatus.FAILED;
      case 'requires_action':
      case 'requires_confirmation':
      case 'requires_payment_method':
      case 'processing':
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapMercadoPagoStatus(status: string | undefined): PaymentStatus {
    switch (status) {
      case 'approved':
        return PaymentStatus.PAID;
      case 'rejected':
      case 'cancelled':
        return PaymentStatus.FAILED;
      case 'pending':
      case 'in_process':
      case 'authorized':
      default:
        return PaymentStatus.PENDING;
    }
  }

  // Simulate payment confirmation for development
  async simulatePaymentConfirmation(orderId: string): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
      },
    });
    this.logger.log(`Simulated payment confirmation for order ${orderId}`);
  }
}
