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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stripe_1 = require("stripe");
const mercadopago_1 = require("mercadopago");
const QRCode = require("qrcode");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(PaymentsService_1.name);
        this.stripe = null;
        this.mercadopago = null;
        const stripeKey = this.configService.get('STRIPE_SECRET_KEY');
        if (stripeKey) {
            this.stripe = new stripe_1.default(stripeKey);
            this.logger.log('Stripe initialized');
        }
        const mpAccessToken = this.configService.get('MERCADOPAGO_ACCESS_TOKEN');
        if (mpAccessToken) {
            this.mercadopago = new mercadopago_1.MercadoPagoConfig({
                accessToken: mpAccessToken,
            });
            this.logger.log('MercadoPago initialized');
        }
    }
    async processPayment(dto, userId) {
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
            throw new common_1.BadRequestException('Order not found');
        }
        if (order.paymentStatus === client_1.PaymentStatus.PAID) {
            throw new common_1.BadRequestException('Order already paid');
        }
        const amount = Number(order.total);
        switch (dto.method) {
            case client_1.PaymentMethod.CREDIT_CARD:
            case client_1.PaymentMethod.DEBIT_CARD:
                return this.processCardPayment(order, dto, amount);
            case client_1.PaymentMethod.PIX:
                return this.processPixPayment(order, amount);
            case client_1.PaymentMethod.CASH:
                return this.processCashPayment(order);
            default:
                throw new common_1.BadRequestException('Invalid payment method');
        }
    }
    async processCardPayment(order, dto, amount) {
        if (this.mercadopago && dto.cardToken) {
            try {
                const payment = new mercadopago_1.Payment(this.mercadopago);
                const result = await payment.create({
                    body: {
                        transaction_amount: amount,
                        token: dto.cardToken,
                        description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
                        installments: 1,
                        payment_method_id: dto.method === client_1.PaymentMethod.CREDIT_CARD ? 'master' : 'debmaster',
                        payer: {
                            email: order.customer?.user?.email || 'customer@foodapp.com',
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
                    success: status === client_1.PaymentStatus.PAID,
                    paymentId: result.id?.toString(),
                    status,
                };
            }
            catch (error) {
                this.logger.error('MercadoPago card payment error:', error);
            }
        }
        if (this.stripe && dto.cardToken) {
            try {
                const paymentIntent = await this.stripe.paymentIntents.create({
                    amount: Math.round(amount * 100),
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
                    success: status === client_1.PaymentStatus.PAID,
                    paymentId: paymentIntent.id,
                    status,
                    redirectUrl: paymentIntent.next_action?.redirect_to_url?.url || undefined,
                };
            }
            catch (error) {
                this.logger.error('Stripe card payment error:', error);
                throw new common_1.BadRequestException('Payment failed');
            }
        }
        this.logger.warn('No payment gateway configured, simulating card payment approval');
        const mockPaymentId = `card_dev_${Date.now()}`;
        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentId: mockPaymentId,
                paymentStatus: client_1.PaymentStatus.PAID,
                paymentMethod: dto.method,
            },
        });
        return {
            success: true,
            paymentId: mockPaymentId,
            status: client_1.PaymentStatus.PAID,
        };
    }
    async processPixPayment(order, amount) {
        if (this.mercadopago) {
            try {
                const payment = new mercadopago_1.Payment(this.mercadopago);
                const result = await payment.create({
                    body: {
                        transaction_amount: amount,
                        description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
                        payment_method_id: 'pix',
                        payer: {
                            email: order.customer?.user?.email || 'customer@foodapp.com',
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
                        paymentStatus: client_1.PaymentStatus.PENDING,
                        paymentMethod: client_1.PaymentMethod.PIX,
                    },
                });
                return {
                    success: true,
                    paymentId: result.id?.toString(),
                    status: client_1.PaymentStatus.PENDING,
                    pixQrCode: pixData?.qr_code_base64,
                    pixCode: pixData?.qr_code,
                };
            }
            catch (error) {
                this.logger.error('MercadoPago Pix error:', error);
            }
        }
        const pixData = await this.generateMockPixCode(order, amount);
        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentId: `pix_${Date.now()}`,
                paymentStatus: client_1.PaymentStatus.PENDING,
                paymentMethod: client_1.PaymentMethod.PIX,
            },
        });
        return {
            success: true,
            paymentId: `pix_${Date.now()}`,
            status: client_1.PaymentStatus.PENDING,
            pixQrCode: pixData.qrCodeBase64,
            pixCode: pixData.copyPasteCode,
        };
    }
    async processCashPayment(order) {
        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: client_1.PaymentStatus.PENDING,
                paymentMethod: client_1.PaymentMethod.CASH,
            },
        });
        return {
            success: true,
            status: client_1.PaymentStatus.PENDING,
        };
    }
    async generateMockPixCode(order, amount) {
        const pixKey = this.configService.get('PIX_KEY') || 'foodapp@pix.com';
        const merchantName = order.restaurant.name.substring(0, 25);
        const city = order.restaurant.city.substring(0, 15);
        const txId = order.id.replace(/-/g, '').substring(0, 25);
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
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        };
    }
    generatePixPayload(data) {
        const formatField = (id, value) => {
            const len = value.length.toString().padStart(2, '0');
            return `${id}${len}${value}`;
        };
        const gui = formatField('00', 'br.gov.bcb.pix');
        const key = formatField('01', data.pixKey);
        const merchantAccount = formatField('26', gui + key);
        const mcc = formatField('52', '0000');
        const currency = formatField('53', '986');
        const amount = formatField('54', data.amount.toFixed(2));
        const country = formatField('58', 'BR');
        const merchantName = formatField('59', data.merchantName);
        const city = formatField('60', data.city);
        const txId = formatField('05', data.txId);
        const additionalData = formatField('62', txId);
        const payloadFormat = formatField('00', '01');
        const payloadWithoutCRC = payloadFormat + merchantAccount + mcc + currency + amount + country + merchantName + city + additionalData + '6304';
        const crc = this.calculateCRC16(payloadWithoutCRC);
        return payloadWithoutCRC + crc;
    }
    calculateCRC16(payload) {
        let crc = 0xFFFF;
        const polynomial = 0x1021;
        for (let i = 0; i < payload.length; i++) {
            crc ^= payload.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ polynomial;
                }
                else {
                    crc <<= 1;
                }
                crc &= 0xFFFF;
            }
        }
        return crc.toString(16).toUpperCase().padStart(4, '0');
    }
    async createStripePaymentIntent(orderId, userId) {
        if (!this.stripe) {
            throw new common_1.BadRequestException('Stripe not configured');
        }
        const order = await this.prisma.order.findFirst({
            where: {
                id: orderId,
                customer: { userId },
            },
        });
        if (!order) {
            throw new common_1.BadRequestException('Order not found');
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
        return { clientSecret: paymentIntent.client_secret };
    }
    async createMercadoPagoPreference(orderId, userId) {
        if (!this.mercadopago) {
            throw new common_1.BadRequestException('MercadoPago not configured');
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
            throw new common_1.BadRequestException('Order not found');
        }
        const preference = new mercadopago_1.Preference(this.mercadopago);
        const baseUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
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
            preferenceId: result.id,
            initPoint: result.init_point,
        };
    }
    async handleStripeWebhook(payload, signature) {
        if (!this.stripe)
            return;
        const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
        if (!webhookSecret) {
            this.logger.warn('Stripe webhook secret not configured');
            return;
        }
        try {
            const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSuccess(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
            }
        }
        catch (error) {
            this.logger.error('Stripe webhook error:', error);
            throw new common_1.BadRequestException('Webhook signature verification failed');
        }
    }
    async handleMercadoPagoWebhook(data) {
        if (!this.mercadopago)
            return;
        try {
            if (data.type === 'payment') {
                const payment = new mercadopago_1.Payment(this.mercadopago);
                const paymentData = await payment.get({ id: data.data.id });
                const orderId = paymentData.metadata?.order_id || paymentData.external_reference;
                if (!orderId)
                    return;
                const status = this.mapMercadoPagoStatus(paymentData.status);
                await this.prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: status,
                    },
                });
                this.logger.log(`MercadoPago payment ${data.data.id} status: ${status}`);
            }
        }
        catch (error) {
            this.logger.error('MercadoPago webhook error:', error);
        }
    }
    async handlePaymentSuccess(paymentIntent) {
        const orderId = paymentIntent.metadata.orderId;
        if (!orderId)
            return;
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: client_1.PaymentStatus.PAID,
            },
        });
        this.logger.log(`Stripe payment ${paymentIntent.id} succeeded for order ${orderId}`);
    }
    async handlePaymentFailed(paymentIntent) {
        const orderId = paymentIntent.metadata.orderId;
        if (!orderId)
            return;
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: client_1.PaymentStatus.FAILED,
            },
        });
        this.logger.log(`Stripe payment ${paymentIntent.id} failed for order ${orderId}`);
    }
    mapStripeStatus(status) {
        switch (status) {
            case 'succeeded':
                return client_1.PaymentStatus.PAID;
            case 'canceled':
                return client_1.PaymentStatus.FAILED;
            case 'requires_action':
            case 'requires_confirmation':
            case 'requires_payment_method':
            case 'processing':
            default:
                return client_1.PaymentStatus.PENDING;
        }
    }
    mapMercadoPagoStatus(status) {
        switch (status) {
            case 'approved':
                return client_1.PaymentStatus.PAID;
            case 'rejected':
            case 'cancelled':
                return client_1.PaymentStatus.FAILED;
            case 'pending':
            case 'in_process':
            case 'authorized':
            default:
                return client_1.PaymentStatus.PENDING;
        }
    }
    async simulatePaymentConfirmation(orderId) {
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: client_1.PaymentStatus.PAID,
            },
        });
        this.logger.log(`Simulated payment confirmation for order ${orderId}`);
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map