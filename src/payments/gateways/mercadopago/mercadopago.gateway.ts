import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import * as QRCode from 'qrcode';
import { PaymentStatus, PaymentMethod, CardProvider } from '@prisma/client';
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
  CardDataInput,
} from '../../interfaces';

@Injectable()
export class MercadoPagoGateway implements PaymentGateway, CardManager {
  private readonly logger = new Logger(MercadoPagoGateway.name);
  private mercadopago: MercadoPagoConfig | null = null;
  private accessToken: string | null = null;

  readonly name = 'mercadopago';
  readonly displayName = 'Mercado Pago';

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
      let mpToken: string | null | undefined = config?.accessToken;

      if (!mpToken) {
        mpToken = await this.settingsService.get<string>('mercadopago_access_token');
      }

      if (!mpToken) {
        mpToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
      }

      if (mpToken && mpToken.trim() !== '') {
        this.mercadopago = new MercadoPagoConfig({
          accessToken: mpToken,
        });
        this.accessToken = mpToken;
        this.logger.log('MercadoPago gateway initialized successfully');
      } else {
        this.mercadopago = null;
        this.accessToken = null;
        this.logger.warn('MercadoPago gateway not configured - no access token found');
      }
    } catch (error) {
      this.logger.error('Failed to initialize MercadoPago gateway:', error);
      this.mercadopago = null;
      this.accessToken = null;
    }
  }

  isConfigured(): boolean {
    return !!this.mercadopago;
  }

  async isEnabled(): Promise<boolean> {
    if (!this.mercadopago) return false;
    const enabled = await this.settingsService.get<boolean>('mercadopago_enabled');
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
    if (!this.mercadopago || !this.accessToken) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: 'MercadoPago não configurado',
        errorCode: 'GATEWAY_NOT_CONFIGURED',
      };
    }

    try {
      // PIX payment
      if (data.method === PaymentMethod.PIX) {
        return this.createPixPayment(order, amount);
      }

      // If using saved card, delegate
      if (data.savedCardId) {
        const savedCard = await this.getSavedCardFromDb(data.savedCardId, order.customerId);
        if (savedCard && savedCard.provider === CardProvider.MERCADOPAGO) {
          return this.chargeWithSavedCard(
            this.mapDbCardToInterface(savedCard),
            amount,
            order,
            data.securityCode,
          );
        }
      }

      // Card payment with cardData or token
      return this.createCardPayment(order, amount, data);
    } catch (error: any) {
      this.logger.error('MercadoPago payment error:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: this.translateError(error),
        errorCode: error.code || 'PAYMENT_FAILED',
      };
    }
  }

  private async createCardPayment(
    order: OrderWithRelations,
    amount: number,
    data: PaymentData,
  ): Promise<PaymentResult> {
    const payment = new Payment(this.mercadopago!);

    // Detect card brand
    const cardBrand = data.cardData ? this.detectCardBrand(data.cardData.cardNumber) : 'master';

    // Build payment body
    const paymentBody: any = {
      transaction_amount: amount,
      description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
      installments: data.installments || 1,
      payment_method_id: cardBrand,
      payer: {
        email: order.customer?.user?.email || 'customer@zefood.com',
        identification: data.cardData
          ? {
              type: data.cardData.identificationType || 'CPF',
              number: data.cardData.identificationNumber,
            }
          : undefined,
      },
      metadata: {
        order_id: order.id,
      },
    };

    // If we have raw card data, create token first
    if (data.cardData) {
      const tokenResult = await this.createCardToken(data.cardData);
      if (!tokenResult.success) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: tokenResult.error || 'Erro ao processar dados do cartão',
          errorCode: 'TOKEN_CREATION_FAILED',
        };
      }
      paymentBody.token = tokenResult.token;

      // Get correct payment_method_id from BIN
      const paymentMethodId = await this.getPaymentMethodFromBin(data.cardData.cardNumber);
      if (paymentMethodId) {
        paymentBody.payment_method_id = paymentMethodId;
      }
    } else if (data.cardToken) {
      paymentBody.token = data.cardToken;
    }

    const result = await payment.create({ body: paymentBody });
    const status = this.mapStatus(result.status || '');

    if (status === PaymentStatus.FAILED) {
      return {
        success: false,
        status,
        error: this.translateError(result.status_detail || 'Pagamento recusado'),
        errorCode: result.status_detail || 'PAYMENT_REJECTED',
        paymentId: result.id?.toString(),
      };
    }

    return {
      success: status === PaymentStatus.PAID,
      paymentId: result.id?.toString(),
      status,
      gatewayStatus: result.status,
    };
  }

  private async createPixPayment(order: OrderWithRelations, amount: number): Promise<PaymentResult> {
    const payment = new Payment(this.mercadopago!);

    try {
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

      return {
        success: true,
        paymentId: result.id?.toString(),
        status: PaymentStatus.PENDING,
        gatewayStatus: result.status,
        pixQrCode: pixData?.qr_code_base64,
        pixCode: pixData?.qr_code,
        pixExpiresAt: (pixData as any)?.expiration_date ? new Date((pixData as any).expiration_date) : undefined,
      };
    } catch (error: any) {
      this.logger.error('MercadoPago PIX error:', error);

      // Fallback to mock PIX for development
      return this.createMockPixPayment(order, amount);
    }
  }

  private async createMockPixPayment(order: OrderWithRelations, amount: number): Promise<PaymentResult> {
    const pixKey = this.configService.get<string>('PIX_KEY') || 'zefood@pix.com';
    const merchantName = order.restaurant.name.substring(0, 25);
    const city = order.restaurant.city?.substring(0, 15) || 'SAO PAULO';
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
      success: true,
      paymentId: `pix_${Date.now()}`,
      status: PaymentStatus.PENDING,
      pixQrCode: qrCodeBase64,
      pixCode: pixPayload,
      pixExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  async processWebhook(payload: any, _headers?: Record<string, string>): Promise<WebhookResult> {
    if (!this.mercadopago) {
      return { success: false, error: 'MercadoPago not configured' };
    }

    try {
      if (payload.type !== 'payment') {
        return { success: true, action: 'unknown' };
      }

      const payment = new Payment(this.mercadopago);
      const paymentData = await payment.get({ id: payload.data.id });

      const orderId = paymentData.metadata?.order_id || paymentData.external_reference;
      const status = this.mapStatus(paymentData.status || '');

      this.logger.log(`MercadoPago webhook: payment ${payload.data.id} status: ${status}`);

      return {
        success: true,
        orderId,
        paymentId: payload.data.id.toString(),
        status,
        action: 'payment.updated',
      };
    } catch (error: any) {
      this.logger.error('MercadoPago webhook error:', error);
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
      case 'approved':
        return PaymentStatus.PAID;
      case 'rejected':
      case 'cancelled':
        return PaymentStatus.FAILED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      case 'pending':
      case 'in_process':
      case 'authorized':
      default:
        return PaymentStatus.PENDING;
    }
  }

  translateError(error: any): string {
    const code = typeof error === 'string' ? error : error?.status_detail || error?.code;

    const errorMessages: Record<string, string> = {
      cc_rejected_bad_filled_card_number: 'Número do cartão inválido',
      cc_rejected_bad_filled_date: 'Data de validade inválida',
      cc_rejected_bad_filled_other: 'Dados do cartão inválidos',
      cc_rejected_bad_filled_security_code: 'Código de segurança inválido',
      cc_rejected_blacklist: 'Cartão não permitido',
      cc_rejected_call_for_authorize: 'Pagamento não autorizado. Contate sua operadora.',
      cc_rejected_card_disabled: 'Cartão desabilitado. Contate sua operadora.',
      cc_rejected_card_error: 'Erro no cartão. Tente novamente.',
      cc_rejected_duplicated_payment: 'Pagamento duplicado',
      cc_rejected_high_risk: 'Pagamento recusado por segurança',
      cc_rejected_insufficient_amount: 'Saldo insuficiente',
      cc_rejected_invalid_installments: 'Parcelamento não disponível',
      cc_rejected_max_attempts: 'Limite de tentativas excedido',
      cc_rejected_other_reason: 'Pagamento recusado pela operadora',
      pending_contingency: 'Pagamento em análise',
      pending_review_manual: 'Pagamento em revisão manual',
    };

    return errorMessages[code] || (typeof error === 'string' ? error : 'Pagamento recusado. Tente novamente.');
  }

  // ============================================
  // Feature Support
  // ============================================

  supportsFeature(feature: PaymentFeature): boolean {
    const supported: PaymentFeature[] = [
      'pix',
      'credit_card',
      'debit_card',
      'saved_cards',
      'refund',
      'boleto',
      'installments',
    ];
    return supported.includes(feature);
  }

  getSupportedFeatures(): PaymentFeature[] {
    return ['pix', 'credit_card', 'debit_card', 'saved_cards', 'refund', 'boleto', 'installments'];
  }

  // ============================================
  // Refunds
  // ============================================

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!this.accessToken) {
      return { success: false, error: 'MercadoPago não configurado' };
    }

    try {
      const body: any = {};
      if (request.amount) {
        body.amount = request.amount;
      }

      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${request.paymentId}/refunds`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Erro ao processar reembolso',
        };
      }

      return {
        success: true,
        refundId: data.id?.toString(),
        amount: data.amount,
        status: data.status,
      };
    } catch (error: any) {
      this.logger.error('MercadoPago refund error:', error);
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
    if (!this.accessToken) {
      throw new Error('MercadoPago não configurado');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // If already has MP customer ID, return it
    if (customer.mpCustomerId) {
      return customer.mpCustomerId;
    }

    // Create new MP customer
    try {
      const response = await fetch('https://api.mercadopago.com/v1/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          email: userData.email,
          first_name: userData.name.split(' ')[0],
          last_name: userData.name.split(' ').slice(1).join(' ') || '',
          identification: userData.document
            ? {
                type: userData.documentType || 'CPF',
                number: userData.document,
              }
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if customer already exists
        if (data.cause?.[0]?.code === 'customer_already_exists') {
          return this.findExistingCustomer(userData.email);
        }
        throw new Error(data.message || 'Erro ao criar cliente');
      }

      // Save to database
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { mpCustomerId: data.id },
      });

      this.logger.log(`Created MP customer ${data.id} for user ${userId}`);
      return data.id;
    } catch (error: any) {
      this.logger.error('Error creating MP customer:', error);
      throw error;
    }
  }

  private async findExistingCustomer(email: string): Promise<string> {
    const response = await fetch(
      `https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    const data = await response.json();

    if (data.results?.[0]?.id) {
      return data.results[0].id;
    }
    throw new Error('Cliente não encontrado');
  }

  async getCustomerId(userId: string): Promise<string | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    return customer?.mpCustomerId || null;
  }

  async saveCard(customerId: string, cardToken: string, setAsDefault?: boolean): Promise<SavedCard> {
    if (!this.accessToken) {
      throw new Error('MercadoPago não configurado');
    }

    // Add card to customer
    const response = await fetch(
      `https://api.mercadopago.com/v1/customers/${customerId}/cards`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({ token: cardToken }),
      },
    );

    const mpCardData = await response.json();

    if (!response.ok || !mpCardData.id) {
      throw new Error(mpCardData.message || 'Erro ao salvar cartão');
    }

    // Find internal customer
    const internalCustomer = await this.prisma.customer.findFirst({
      where: { mpCustomerId: customerId },
    });

    if (!internalCustomer) {
      throw new Error('Customer not found');
    }

    // Check if should be default
    const existingCards = await this.prisma.savedCard.count({
      where: { customerId: internalCustomer.id },
    });

    const isDefault = setAsDefault ?? existingCards === 0;

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
        provider: CardProvider.MERCADOPAGO,
        mpCardId: mpCardData.id,
        lastFourDigits: mpCardData.last_four_digits,
        expirationMonth: mpCardData.expiration_month,
        expirationYear: mpCardData.expiration_year,
        cardholderName: mpCardData.cardholder?.name || 'Titular',
        brand: mpCardData.payment_method?.id || 'credit_card',
        paymentMethodId: mpCardData.payment_method?.id || 'credit_card',
        isDefault,
      },
    });

    this.logger.log(`Saved MP card ${savedCard.id} for customer ${internalCustomer.id}`);

    return {
      id: savedCard.id,
      provider: this.name,
      gatewayCardId: mpCardData.id,
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
    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: cardId,
        customer: { mpCustomerId: customerId },
        provider: CardProvider.MERCADOPAGO,
      },
    });

    if (!savedCard) {
      throw new Error('Cartão não encontrado');
    }

    // Delete from MP
    if (savedCard.mpCardId && this.accessToken) {
      try {
        await fetch(
          `https://api.mercadopago.com/v1/customers/${customerId}/cards/${savedCard.mpCardId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this.accessToken}` },
          },
        );
      } catch (error) {
        this.logger.warn('Failed to delete card from MP:', error);
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

    this.logger.log(`Deleted MP card ${cardId}`);
  }

  async listCards(customerId: string): Promise<SavedCard[]> {
    const cards = await this.prisma.savedCard.findMany({
      where: {
        customer: { mpCustomerId: customerId },
        provider: CardProvider.MERCADOPAGO,
      },
    });

    return cards.map((card) => ({
      id: card.id,
      provider: this.name,
      gatewayCardId: card.mpCardId || '',
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
        customer: { mpCustomerId: customerId },
      },
    });

    if (!savedCard) {
      throw new Error('Cartão não encontrado');
    }

    await this.prisma.savedCard.updateMany({
      where: { customerId: savedCard.customerId },
      data: { isDefault: false },
    });

    await this.prisma.savedCard.update({
      where: { id: cardId },
      data: { isDefault: true },
    });
  }

  async chargeWithSavedCard(
    savedCard: SavedCard,
    amount: number,
    order: OrderWithRelations,
    securityCode?: string,
  ): Promise<PaymentResult> {
    if (!this.mercadopago || !this.accessToken) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: 'MercadoPago não configurado',
        errorCode: 'GATEWAY_NOT_CONFIGURED',
      };
    }

    try {
      const customer = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
        include: { user: true },
      });

      if (!customer?.mpCustomerId) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Cliente não possui conta MercadoPago',
          errorCode: 'NO_MP_CUSTOMER',
        };
      }

      // MercadoPago requires CVV for saved cards, create token with CVV
      let token = savedCard.gatewayCardId;

      if (securityCode) {
        // Create token with CVV for saved card
        const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify({
            card_id: savedCard.gatewayCardId,
            security_code: securityCode,
          }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenResponse.ok && tokenData.id) {
          token = tokenData.id;
        }
      }

      const payment = new Payment(this.mercadopago);

      const result = await payment.create({
        body: {
          transaction_amount: amount,
          description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
          installments: 1,
          payment_method_id: savedCard.brand,
          token: token,
          payer: {
            id: customer.mpCustomerId,
            email: customer.user.email,
          },
          metadata: {
            order_id: order.id,
          },
        },
      });

      const status = this.mapStatus(result.status || '');

      if (status === PaymentStatus.FAILED) {
        return {
          success: false,
          status,
          error: this.translateError(result.status_detail || 'Pagamento recusado'),
          errorCode: result.status_detail || 'PAYMENT_REJECTED',
          paymentId: result.id?.toString(),
        };
      }

      return {
        success: status === PaymentStatus.PAID,
        paymentId: result.id?.toString(),
        status,
        gatewayStatus: result.status,
      };
    } catch (error: any) {
      this.logger.error('MP saved card payment error:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: this.translateError(error),
        errorCode: error.code || 'PAYMENT_FAILED',
      };
    }
  }

  requiresCvvForSavedCard(): boolean {
    return true; // MercadoPago requires CVV for saved card payments
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Create card token from raw card data
   */
  async createCardToken(cardData: CardDataInput): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'MercadoPago não configurado' };
    }

    try {
      const response = await fetch('https://api.mercadopago.com/v1/card_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          card_number: cardData.cardNumber.replace(/\s/g, ''),
          cardholder: {
            name: cardData.cardholderName,
            identification: {
              type: cardData.identificationType || 'CPF',
              number: cardData.identificationNumber,
            },
          },
          expiration_month: parseInt(cardData.expirationMonth),
          expiration_year: parseInt(
            cardData.expirationYear.length === 2
              ? `20${cardData.expirationYear}`
              : cardData.expirationYear,
          ),
          security_code: cardData.securityCode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.id) {
        return {
          success: false,
          error: data.cause?.[0]?.description || data.message || 'Erro ao processar dados do cartão',
        };
      }

      return { success: true, token: data.id };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao criar token' };
    }
  }

  /**
   * Get payment method ID from BIN (card number prefix)
   */
  private async getPaymentMethodFromBin(cardNumber: string): Promise<string | null> {
    if (!this.accessToken) return null;

    try {
      const bin = cardNumber.replace(/\s/g, '').substring(0, 6);
      const response = await fetch(
        `https://api.mercadopago.com/v1/payment_methods/search?bins=${bin}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );

      const data = await response.json();
      return data.results?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Detect card brand from number
   */
  private detectCardBrand(cardNumber: string): string {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const bin = cleanNumber.substring(0, 6);

    // Elo BINs (simplified check)
    if (/^(504175|506699|509\d{3}|627780|636297|636368|6500\d{2}|6550\d{2})/.test(cleanNumber)) {
      return 'elo';
    }

    // Test Mastercard from MP
    if (bin === '503143') return 'master';

    // Hipercard
    if (/^(606282|3841|6370)/.test(cleanNumber)) return 'hipercard';

    // Amex
    if (/^3[47]/.test(cleanNumber)) return 'amex';

    // Visa
    if (/^4/.test(cleanNumber)) return 'visa';

    // Mastercard
    if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'master';

    return 'visa';
  }

  /**
   * Create Checkout Pro preference
   */
  async createPreference(
    order: OrderWithRelations,
    backUrls: { success: string; failure: string; pending: string },
    notificationUrl?: string,
  ): Promise<{ preferenceId: string; initPoint: string }> {
    if (!this.mercadopago) {
      throw new Error('MercadoPago não configurado');
    }

    const preference = new Preference(this.mercadopago);

    const result = await preference.create({
      body: {
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          title: item.menuItem?.name || 'Item',
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          currency_id: 'BRL',
        })),
        back_urls: backUrls,
        auto_return: 'approved',
        external_reference: order.id,
        notification_url: notificationUrl,
      },
    });

    return {
      preferenceId: result.id!,
      initPoint: result.init_point!,
    };
  }

  /**
   * Get access token for internal use
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get MercadoPago config instance
   */
  getMercadoPagoInstance(): MercadoPagoConfig | null {
    return this.mercadopago;
  }

  // ============================================
  // PIX Helper Methods
  // ============================================

  private generatePixPayload(data: {
    pixKey: string;
    merchantName: string;
    city: string;
    amount: number;
    txId: string;
  }): string {
    const formatField = (id: string, value: string) => {
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

    const payloadWithoutCRC =
      payloadFormat + merchantAccount + mcc + currency + amount + country + merchantName + city + additionalData + '6304';

    const crc = this.calculateCRC16(payloadWithoutCRC);
    return payloadWithoutCRC + crc;
  }

  private calculateCRC16(payload: string): string {
    let crc = 0xffff;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc <<= 1;
        }
        crc &= 0xffff;
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
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
      gatewayCardId: dbCard.mpCardId || '',
      gatewayCustomerId: dbCard.customer?.mpCustomerId || '',
      lastFourDigits: dbCard.lastFourDigits,
      expirationMonth: dbCard.expirationMonth,
      expirationYear: dbCard.expirationYear,
      cardholderName: dbCard.cardholderName,
      brand: dbCard.brand,
      isDefault: dbCard.isDefault,
    };
  }
}
