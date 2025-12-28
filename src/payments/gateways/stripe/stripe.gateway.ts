import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
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

@Injectable()
export class StripeGateway implements PaymentGateway, CardManager {
  private readonly logger = new Logger(StripeGateway.name);
  private stripe: Stripe | null = null;
  private secretKey: string | null = null;

  readonly name = 'stripe';
  readonly displayName = 'Stripe';

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
      // Try config first, then database, then env
      let stripeKey: string | null | undefined = config?.secretKey;

      if (!stripeKey) {
        stripeKey = await this.settingsService.get<string>('stripe_secret_key');
      }

      if (!stripeKey) {
        stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
      }

      if (stripeKey && stripeKey.trim() !== '') {
        this.stripe = new Stripe(stripeKey);
        this.secretKey = stripeKey;
        this.logger.log('Stripe gateway initialized successfully');
      } else {
        this.stripe = null;
        this.secretKey = null;
        this.logger.warn('Stripe gateway not configured - no secret key found');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Stripe gateway:', error);
      this.stripe = null;
      this.secretKey = null;
    }
  }

  isConfigured(): boolean {
    return !!this.stripe;
  }

  async isEnabled(): Promise<boolean> {
    if (!this.stripe) return false;
    const enabled = await this.settingsService.get<boolean>('stripe_enabled');
    return enabled ?? true;
  }

  // ============================================
  // Payment Processing
  // ============================================

  async createPayment(
    order: OrderWithRelations,
    amount: number,
    data: PaymentData,
  ): Promise<PaymentResult> {
    if (!this.stripe) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: 'Stripe não configurado',
        errorCode: 'GATEWAY_NOT_CONFIGURED',
      };
    }

    try {
      // If using saved card, delegate to saved card method
      if (data.savedCardId) {
        const savedCard = await this.getSavedCardFromDb(data.savedCardId, order.customerId);
        if (savedCard && savedCard.provider === CardProvider.STRIPE) {
          return this.chargeWithSavedCard(
            this.mapDbCardToInterface(savedCard),
            amount,
            order,
          );
        }
      }

      // New card payment with token
      if (!data.cardToken) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Token do cartão não fornecido',
          errorCode: 'MISSING_CARD_TOKEN',
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: 'brl',
        payment_method: data.cardToken,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          orderId: order.id,
        },
      });

      const status = this.mapStatus(paymentIntent.status);

      return {
        success: status === PaymentStatus.PAID,
        paymentId: paymentIntent.id,
        status,
        gatewayStatus: paymentIntent.status,
        redirectUrl: paymentIntent.next_action?.redirect_to_url?.url ?? undefined,
        metadata: {
          paymentIntentId: paymentIntent.id,
        },
      };
    } catch (error: any) {
      this.logger.error('Stripe payment error:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: this.translateError(error),
        errorCode: error.code || 'PAYMENT_FAILED',
      };
    }
  }

  async processWebhook(payload: any, headers?: Record<string, string>): Promise<WebhookResult> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    try {
      // Get webhook secret from database or env
      let webhookSecret: string | null | undefined = await this.settingsService.get<string>('stripe_webhook_secret');
      if (!webhookSecret) {
        webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      }

      if (!webhookSecret) {
        this.logger.warn('Stripe webhook secret not configured');
        return { success: false, error: 'Webhook secret not configured' };
      }

      const signature = headers?.['stripe-signature'];
      if (!signature) {
        return { success: false, error: 'Missing signature header' };
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      let orderId: string | undefined;
      let status: PaymentStatus | undefined;
      let action: WebhookResult['action'] = 'unknown';

      switch (event.type) {
        case 'payment_intent.succeeded':
          const succeededIntent = event.data.object as Stripe.PaymentIntent;
          orderId = succeededIntent.metadata.orderId;
          status = PaymentStatus.PAID;
          action = 'payment.updated';
          break;

        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object as Stripe.PaymentIntent;
          orderId = failedIntent.metadata.orderId;
          status = PaymentStatus.FAILED;
          action = 'payment.updated';
          break;

        case 'charge.refunded':
          const charge = event.data.object as Stripe.Charge;
          orderId = charge.metadata?.orderId;
          status = PaymentStatus.REFUNDED;
          action = 'payment.refunded';
          break;
      }

      return {
        success: true,
        orderId,
        paymentId: (event.data.object as any).id,
        status,
        action,
      };
    } catch (error: any) {
      this.logger.error('Stripe webhook error:', error);
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

  translateError(error: any): string {
    const code = error?.code || error?.type;
    const errorMessages: Record<string, string> = {
      card_declined: 'Cartão recusado',
      insufficient_funds: 'Saldo insuficiente',
      expired_card: 'Cartão expirado',
      incorrect_cvc: 'Código de segurança incorreto',
      incorrect_number: 'Número do cartão incorreto',
      invalid_expiry_month: 'Mês de validade inválido',
      invalid_expiry_year: 'Ano de validade inválido',
      processing_error: 'Erro ao processar pagamento',
      authentication_required: 'Autenticação adicional necessária',
      rate_limit: 'Muitas tentativas. Tente novamente em alguns minutos.',
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
      'saved_cards',
      'one_click',
      'refund',
      'partial_refund',
      'installments',
    ];
    return supported.includes(feature);
  }

  getSupportedFeatures(): PaymentFeature[] {
    return ['credit_card', 'debit_card', 'saved_cards', 'one_click', 'refund', 'partial_refund', 'installments'];
  }

  // ============================================
  // Refunds
  // ============================================

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe não configurado' };
    }

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: request.paymentId,
      };

      if (request.amount) {
        refundParams.amount = Math.round(request.amount * 100);
      }

      if (request.reason) {
        refundParams.reason = 'requested_by_customer';
        refundParams.metadata = { reason: request.reason };
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status ?? undefined,
      };
    } catch (error: any) {
      this.logger.error('Stripe refund error:', error);
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
    if (!this.stripe) {
      throw new Error('Stripe não configurado');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // If already has Stripe customer ID, return it
    if (customer.stripeCustomerId) {
      return customer.stripeCustomerId;
    }

    // Create new Stripe customer
    const stripeCustomer = await this.stripe.customers.create({
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      metadata: {
        userId: userId,
        customerId: customer.id,
      },
    });

    // Save to database
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    this.logger.log(`Created Stripe customer ${stripeCustomer.id} for user ${userId}`);
    return stripeCustomer.id;
  }

  async getCustomerId(userId: string): Promise<string | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    return customer?.stripeCustomerId || null;
  }

  async saveCard(customerId: string, cardToken: string, setAsDefault?: boolean): Promise<SavedCard> {
    if (!this.stripe) {
      throw new Error('Stripe não configurado');
    }

    // Attach PaymentMethod to customer
    const paymentMethod = await this.stripe.paymentMethods.attach(cardToken, {
      customer: customerId,
    });

    if (!paymentMethod.card) {
      throw new Error('PaymentMethod não é um cartão');
    }

    // Find internal customer
    const internalCustomer = await this.prisma.customer.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!internalCustomer) {
      throw new Error('Customer not found');
    }

    // Check if should be default
    const existingCards = await this.prisma.savedCard.count({
      where: { customerId: internalCustomer.id },
    });

    const isDefault = setAsDefault ?? existingCards === 0;

    // If setting as default, unset others
    if (isDefault) {
      await this.prisma.savedCard.updateMany({
        where: { customerId: internalCustomer.id },
        data: { isDefault: false },
      });
    }

    // Save to database
    const savedCard = await this.prisma.savedCard.create({
      data: {
        customerId: internalCustomer.id,
        provider: CardProvider.STRIPE,
        stripePaymentMethodId: paymentMethod.id,
        lastFourDigits: paymentMethod.card.last4,
        expirationMonth: paymentMethod.card.exp_month,
        expirationYear: paymentMethod.card.exp_year,
        cardholderName: paymentMethod.billing_details?.name || 'Titular',
        brand: paymentMethod.card.brand,
        paymentMethodId: paymentMethod.id,
        isDefault,
      },
    });

    this.logger.log(`Saved Stripe card ${savedCard.id} for customer ${internalCustomer.id}`);

    return {
      id: savedCard.id,
      provider: this.name,
      gatewayCardId: paymentMethod.id,
      gatewayCustomerId: customerId,
      lastFourDigits: savedCard.lastFourDigits,
      expirationMonth: savedCard.expirationMonth,
      expirationYear: savedCard.expirationYear,
      cardholderName: savedCard.cardholderName,
      brand: savedCard.brand,
      isDefault: savedCard.isDefault,
    };
  }

  async deleteCard(customerId: string, cardId: string): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe não configurado');
    }

    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: cardId,
        customer: { stripeCustomerId: customerId },
        provider: CardProvider.STRIPE,
      },
    });

    if (!savedCard) {
      throw new Error('Cartão não encontrado');
    }

    // Detach from Stripe
    if (savedCard.stripePaymentMethodId) {
      try {
        await this.stripe.paymentMethods.detach(savedCard.stripePaymentMethodId);
      } catch (error) {
        this.logger.warn('Failed to detach Stripe PaymentMethod:', error);
      }
    }

    // Delete from database
    await this.prisma.savedCard.delete({
      where: { id: cardId },
    });

    // If was default, set another as default
    if (savedCard.isDefault) {
      const nextCard = await this.prisma.savedCard.findFirst({
        where: { customerId: savedCard.customerId },
      });
      if (nextCard) {
        await this.prisma.savedCard.update({
          where: { id: nextCard.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Deleted Stripe card ${cardId}`);
  }

  async listCards(customerId: string): Promise<SavedCard[]> {
    const cards = await this.prisma.savedCard.findMany({
      where: {
        customer: { stripeCustomerId: customerId },
        provider: CardProvider.STRIPE,
      },
    });

    return cards.map((card) => ({
      id: card.id,
      provider: this.name,
      gatewayCardId: card.stripePaymentMethodId || '',
      gatewayCustomerId: customerId,
      lastFourDigits: card.lastFourDigits,
      expirationMonth: card.expirationMonth,
      expirationYear: card.expirationYear,
      cardholderName: card.cardholderName,
      brand: card.brand,
      isDefault: card.isDefault,
    }));
  }

  async setDefaultCard(customerId: string, cardId: string): Promise<void> {
    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: cardId,
        customer: { stripeCustomerId: customerId },
      },
    });

    if (!savedCard) {
      throw new Error('Cartão não encontrado');
    }

    // Unset all defaults
    await this.prisma.savedCard.updateMany({
      where: { customerId: savedCard.customerId },
      data: { isDefault: false },
    });

    // Set this as default
    await this.prisma.savedCard.update({
      where: { id: cardId },
      data: { isDefault: true },
    });
  }

  async chargeWithSavedCard(
    savedCard: SavedCard,
    amount: number,
    order: OrderWithRelations,
    _securityCode?: string, // Not needed for Stripe 1-click
  ): Promise<PaymentResult> {
    if (!this.stripe) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: 'Stripe não configurado',
        errorCode: 'GATEWAY_NOT_CONFIGURED',
      };
    }

    try {
      // Get Stripe customer ID
      const customer = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
      });

      if (!customer?.stripeCustomerId) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Cliente não possui conta Stripe',
          errorCode: 'NO_STRIPE_CUSTOMER',
        };
      }

      // Create PaymentIntent with saved card (off_session = 1-click, no CVV!)
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'brl',
        customer: customer.stripeCustomerId,
        payment_method: savedCard.gatewayCardId,
        off_session: true,
        confirm: true,
        metadata: {
          orderId: order.id,
          savedCardId: savedCard.id,
        },
      });

      const status = this.mapStatus(paymentIntent.status);

      this.logger.log(`Stripe 1-click payment ${paymentIntent.id} status: ${status}`);

      return {
        success: status === PaymentStatus.PAID,
        paymentId: paymentIntent.id,
        status,
        gatewayStatus: paymentIntent.status,
      };
    } catch (error: any) {
      this.logger.error('Stripe saved card payment error:', error);

      // Handle specific Stripe errors
      if (error.code === 'authentication_required') {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Autenticação adicional necessária. Tente pagar com o cartão novamente.',
          errorCode: 'AUTHENTICATION_REQUIRED',
        };
      }

      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: this.translateError(error),
        errorCode: error.code || 'PAYMENT_FAILED',
      };
    }
  }

  requiresCvvForSavedCard(): boolean {
    return false; // Stripe 1-click doesn't require CVV
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get Stripe publishable key for frontend
   */
  async getPublishableKey(): Promise<string | null> {
    let key = await this.settingsService.get<string>('stripe_public_key');
    if (!key) {
      key = this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? null;
    }
    return key;
  }

  /**
   * Create PaymentIntent for frontend
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
  ): Promise<{ clientSecret: string }> {
    if (!this.stripe) {
      throw new Error('Stripe não configurado');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'brl',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId,
      },
    });

    return { clientSecret: paymentIntent.client_secret! };
  }

  /**
   * Create SetupIntent for saving cards
   */
  async createSetupIntent(stripeCustomerId: string): Promise<{ clientSecret: string }> {
    if (!this.stripe) {
      throw new Error('Stripe não configurado');
    }

    const setupIntent = await this.stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return { clientSecret: setupIntent.client_secret! };
  }

  /**
   * Get raw Stripe instance (for direct API access if needed)
   */
  getStripeInstance(): Stripe | null {
    return this.stripe;
  }

  private async getSavedCardFromDb(cardId: string, customerId: string) {
    return this.prisma.savedCard.findFirst({
      where: {
        id: cardId,
        customerId,
      },
    });
  }

  private mapDbCardToInterface(dbCard: any): SavedCard {
    return {
      id: dbCard.id,
      provider: this.name,
      gatewayCardId: dbCard.stripePaymentMethodId || '',
      gatewayCustomerId: dbCard.customer?.stripeCustomerId || '',
      lastFourDigits: dbCard.lastFourDigits,
      expirationMonth: dbCard.expirationMonth,
      expirationYear: dbCard.expirationYear,
      cardholderName: dbCard.cardholderName,
      brand: dbCard.brand,
      isDefault: dbCard.isDefault,
    };
  }
}
