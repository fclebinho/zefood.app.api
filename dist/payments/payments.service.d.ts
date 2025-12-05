import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
export interface CreatePaymentDto {
    orderId: string;
    method: PaymentMethod;
    cardToken?: string;
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
export declare class PaymentsService {
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private stripe;
    private mercadopago;
    constructor(configService: ConfigService, prisma: PrismaService);
    processPayment(dto: CreatePaymentDto, userId: string): Promise<PaymentResult>;
    private processCardPayment;
    private processPixPayment;
    private processCashPayment;
    private generateMockPixCode;
    private generatePixPayload;
    private calculateCRC16;
    createStripePaymentIntent(orderId: string, userId: string): Promise<{
        clientSecret: string;
    }>;
    createMercadoPagoPreference(orderId: string, userId: string): Promise<{
        preferenceId: string;
        initPoint: string;
    }>;
    handleStripeWebhook(payload: Buffer, signature: string): Promise<void>;
    handleMercadoPagoWebhook(data: any): Promise<void>;
    private handlePaymentSuccess;
    private handlePaymentFailed;
    private mapStripeStatus;
    private mapMercadoPagoStatus;
    simulatePaymentConfirmation(orderId: string): Promise<void>;
}
