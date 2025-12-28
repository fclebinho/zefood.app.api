import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, CardProvider } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SettingsService } from '../../../settings/settings.service';
import {
  PaymentGateway,
  CardManager,
  GatewayConfig,
  PaymentData,
  PaymentResult,
  WebhookResult,
  PaymentFeature,
  RefundRequest,
  RefundResult,
  OrderWithRelations,
  UserData,
  SavedCard,
} from '../../interfaces';

/**
 * PagSeguro Payment Gateway Implementation
 *
 * Documentação: https://dev.pagseguro.uol.com.br/reference
 *
 * Para usar este gateway, configure as seguintes settings:
 * - pagseguro_token: Token de autenticação
 * - pagseguro_email: Email da conta PagSeguro
 * - pagseguro_enabled: true/false
 * - pagseguro_sandbox: true/false (ambiente de testes)
 */
@Injectable()
export class PagSeguroGateway implements PaymentGateway, CardManager {
  private readonly logger = new Logger(PagSeguroGateway.name);
  private token: string | null = null;
  private email: string | null = null;
  private sandbox: boolean = false;

  readonly name = 'pagseguro';
  readonly displayName = 'PagSeguro';

  private get baseUrl(): string {
    return this.sandbox
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  // ============================================
  // Lifecycle Methods
  // ============================================

  async initialize(config?: GatewayConfig): Promise<void> {
    try {
      // Get token
      let token: string | null | undefined = config?.secretKey;
      if (!token) {
        token = await this.settingsService.get<string>('pagseguro_token');
      }
      if (!token) {
        token = this.configService.get<string>('PAGSEGURO_TOKEN');
      }

      // Get email
      let email: string | null | undefined = config?.publicKey;
      if (!email) {
        email = await this.settingsService.get<string>('pagseguro_email');
      }
      if (!email) {
        email = this.configService.get<string>('PAGSEGURO_EMAIL');
      }

      // Get sandbox mode
      const sandboxSetting = await this.settingsService.get<boolean>('pagseguro_sandbox');
      this.sandbox = sandboxSetting ?? this.configService.get<boolean>('PAGSEGURO_SANDBOX') ?? false;

      if (token && email) {
        this.token = token;
        this.email = email;
        this.logger.log(`PagSeguro gateway initialized (sandbox: ${this.sandbox})`);
      } else {
        this.token = null;
        this.email = null;
        this.logger.warn('PagSeguro gateway not configured');
      }
    } catch (error) {
      this.logger.error('Failed to initialize PagSeguro:', error);
      this.token = null;
      this.email = null;
    }
  }

  isConfigured(): boolean {
    return !!this.token && !!this.email;
  }

  async isEnabled(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const enabled = await this.settingsService.get<boolean>('pagseguro_enabled');
    return enabled ?? false; // Disabled by default until configured
  }

  // ============================================
  // Payment Processing
  // ============================================

  async createPayment(
    order: OrderWithRelations,
    amount: number,
    data: PaymentData,
  ): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: 'PagSeguro não configurado',
        errorCode: 'GATEWAY_NOT_CONFIGURED',
      };
    }

    try {
      // PagSeguro API v4 - Create charge
      const response = await fetch(`${this.baseUrl}/charges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'x-idempotency-key': `order_${order.id}`,
        },
        body: JSON.stringify({
          reference_id: order.id,
          description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
          amount: {
            value: Math.round(amount * 100), // PagSeguro uses cents
            currency: 'BRL',
          },
          payment_method: this.buildPaymentMethod(data),
          notification_urls: [
            `${this.configService.get('APP_URL')}/api/payments/webhook/pagseguro`,
          ],
          metadata: {
            order_id: order.id,
            restaurant_id: order.restaurantId,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error('PagSeguro payment error:', result);
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: this.translateError(result),
          errorCode: result.error_messages?.[0]?.code || 'PAYMENT_FAILED',
        };
      }

      const status = this.mapStatus(result.status);

      return {
        success: status === PaymentStatus.PAID,
        paymentId: result.id,
        status,
        gatewayStatus: result.status,
        metadata: {
          chargeId: result.id,
        },
      };
    } catch (error: any) {
      this.logger.error('PagSeguro payment error:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: this.translateError(error),
        errorCode: 'PAYMENT_FAILED',
      };
    }
  }

  private buildPaymentMethod(data: PaymentData): any {
    // Credit card payment
    if (data.cardToken) {
      return {
        type: 'CREDIT_CARD',
        installments: data.installments || 1,
        capture: true,
        card: {
          encrypted: data.cardToken, // PagSeguro encrypted card
        },
      };
    }

    // Default to boleto if no card data
    return {
      type: 'BOLETO',
      boleto: {
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    };
  }

  async processWebhook(payload: any, _headers?: Record<string, string>): Promise<WebhookResult> {
    try {
      // PagSeguro sends notifications about charge status changes
      const chargeId = payload.id;
      const status = this.mapStatus(payload.status);

      // Get order ID from metadata or reference
      const orderId = payload.metadata?.order_id || payload.reference_id;

      this.logger.log(`PagSeguro webhook: charge ${chargeId} status: ${status}`);

      return {
        success: true,
        orderId,
        paymentId: chargeId,
        status,
        action: 'payment.updated',
      };
    } catch (error: any) {
      this.logger.error('PagSeguro webhook error:', error);
      return {
        success: false,
        error: error.message || 'Webhook processing failed',
      };
    }
  }

  // ============================================
  // Status Mapping
  // ============================================

  mapStatus(gatewayStatus: string): PaymentStatus {
    switch (gatewayStatus) {
      case 'PAID':
      case 'AUTHORIZED':
        return PaymentStatus.PAID;
      case 'DECLINED':
      case 'CANCELED':
        return PaymentStatus.FAILED;
      case 'WAITING':
      case 'IN_ANALYSIS':
      default:
        return PaymentStatus.PENDING;
    }
  }

  translateError(error: any): string {
    const code = error?.error_messages?.[0]?.code || error?.code;

    const errorMessages: Record<string, string> = {
      '40001': 'Parâmetro obrigatório não informado',
      '40002': 'Parâmetro inválido',
      '40003': 'Pagamento recusado pela operadora',
      '40004': 'Cartão expirado',
      '40005': 'Saldo insuficiente',
      '40006': 'Cartão bloqueado',
      '40007': 'Transação não permitida',
      '40008': 'Número de parcelas inválido',
      '40009': 'Valor abaixo do mínimo',
      '40010': 'Valor acima do máximo',
    };

    return errorMessages[code] || error?.message || 'Erro ao processar pagamento';
  }

  // ============================================
  // Feature Support
  // ============================================

  supportsFeature(feature: PaymentFeature): boolean {
    const supported: PaymentFeature[] = [
      'credit_card',
      'debit_card',
      'boleto',
      'pix',
      'refund',
      'installments',
    ];
    return supported.includes(feature);
  }

  getSupportedFeatures(): PaymentFeature[] {
    return ['credit_card', 'debit_card', 'boleto', 'pix', 'refund', 'installments'];
  }

  // ============================================
  // Refunds
  // ============================================

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'PagSeguro não configurado' };
    }

    try {
      const body: any = {};
      if (request.amount) {
        body.amount = {
          value: Math.round(request.amount * 100),
        };
      }

      const response = await fetch(
        `${this.baseUrl}/charges/${request.paymentId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
          },
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: this.translateError(data),
        };
      }

      return {
        success: true,
        refundId: data.id,
        amount: data.amount?.value ? data.amount.value / 100 : undefined,
        status: data.status,
      };
    } catch (error: any) {
      this.logger.error('PagSeguro refund error:', error);
      return {
        success: false,
        error: this.translateError(error),
      };
    }
  }

  // ============================================
  // CardManager Implementation
  // ============================================

  async getOrCreateCustomer(userId: string, userData: UserData): Promise<string> {
    // PagSeguro doesn't have a customer API like Stripe/MP
    // We use our internal customer ID
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer.id;
  }

  async getCustomerId(userId: string): Promise<string | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    return customer?.id || null;
  }

  async saveCard(_customerId: string, _cardToken: string, _setAsDefault?: boolean): Promise<SavedCard> {
    // PagSeguro doesn't support saving cards via API in the same way
    // Cards are tokenized per-transaction
    throw new Error('PagSeguro não suporta salvamento de cartões via API');
  }

  async deleteCard(_customerId: string, _cardId: string): Promise<void> {
    throw new Error('PagSeguro não suporta gerenciamento de cartões');
  }

  async listCards(_customerId: string): Promise<SavedCard[]> {
    // Return empty - PagSeguro doesn't have saved cards
    return [];
  }

  async setDefaultCard(_customerId: string, _cardId: string): Promise<void> {
    throw new Error('PagSeguro não suporta gerenciamento de cartões');
  }

  async chargeWithSavedCard(
    _savedCard: SavedCard,
    _amount: number,
    _order: OrderWithRelations,
    _securityCode?: string,
  ): Promise<PaymentResult> {
    return {
      success: false,
      status: PaymentStatus.FAILED,
      error: 'PagSeguro não suporta pagamento com cartão salvo',
      errorCode: 'FEATURE_NOT_SUPPORTED',
    };
  }

  requiresCvvForSavedCard(): boolean {
    return true; // N/A - doesn't support saved cards
  }
}
