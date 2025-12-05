import { RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentMethod } from '@prisma/client';
declare class ProcessPaymentDto {
    orderId: string;
    method: PaymentMethod;
    cardToken?: string;
}
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    processPayment(dto: ProcessPaymentDto, req: any): Promise<import("./payments.service").PaymentResult>;
    createStripeIntent(orderId: string, req: any): Promise<{
        clientSecret: string;
    }>;
    createMercadoPagoPreference(orderId: string, req: any): Promise<{
        preferenceId: string;
        initPoint: string;
    }>;
    createPixPayment(orderId: string, req: any): Promise<import("./payments.service").PaymentResult>;
    handleStripeWebhook(req: RawBodyRequest<Request>, signature: string): Promise<{
        received: boolean;
    }>;
    handleMercadoPagoWebhook(data: any): Promise<{
        received: boolean;
    }>;
    simulatePayment(orderId: string): Promise<{
        success: boolean;
    }>;
}
export {};
