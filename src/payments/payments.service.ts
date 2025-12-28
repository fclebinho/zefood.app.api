import { Injectable, Logger, BadRequestException, forwardRef, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, PaymentStatus, CardProvider } from '@prisma/client';
import { OrdersGateway } from '../websocket/orders.gateway';
import { SettingsService } from '../settings/settings.service';
import { GatewayRegistry } from './gateways/gateway.registry';
import { StripeGateway } from './gateways/stripe/stripe.gateway';
import { MercadoPagoGateway } from './gateways/mercadopago/mercadopago.gateway';

export interface CardDataInput {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}

export interface CreatePaymentDto {
  orderId: string;
  method: PaymentMethod;
  // For card payments
  cardToken?: string;
  cardData?: CardDataInput;
  // For saved cards - uses MP card id
  savedCardId?: string;
  // CVV for saved card payments
  securityCode?: string;
}

export interface SavedCardDto {
  id: string;
  provider: CardProvider;
  mpCardId?: string;
  stripePaymentMethodId?: string;
  lastFourDigits: string;
  expirationMonth: number;
  expirationYear: number;
  cardholderName: string;
  brand: string;
  isDefault: boolean;
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
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;
  private mercadopago: MercadoPagoConfig | null = null;
  private stripeSecretKey: string | null = null;
  private mpAccessToken: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdersGateway))
    private readonly ordersGateway: OrdersGateway,
    private readonly settingsService: SettingsService,
    private readonly gatewayRegistry: GatewayRegistry,
    private readonly stripeGateway: StripeGateway,
    private readonly mercadoPagoGateway: MercadoPagoGateway,
  ) {}

  // Initialize gateways after SettingsService has loaded its cache
  async onModuleInit() {
    await this.initializeGateways();
  }

  /**
   * Inicializa os gateways de pagamento usando configurações do banco de dados
   * Fallback para variáveis de ambiente se não houver configuração no banco
   */
  private async initializeGateways() {
    await this.initializeStripe();
    await this.initializeMercadoPago();
  }

  /**
   * Inicializa ou reinicializa o Stripe com a chave do banco ou env
   */
  async initializeStripe(): Promise<boolean> {
    try {
      // Primeiro tenta buscar do banco de dados
      let stripeKey: string | null | undefined =
        await this.settingsService.get<string>('stripe_secret_key');

      // Fallback para variável de ambiente
      if (!stripeKey) {
        stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY') ?? null;
      }

      if (stripeKey && stripeKey.trim() !== '') {
        this.stripe = new Stripe(stripeKey);
        this.stripeSecretKey = stripeKey;
        this.logger.log('Stripe initialized successfully');
        return true;
      } else {
        this.stripe = null;
        this.stripeSecretKey = null;
        this.logger.warn('Stripe not configured - no secret key found');
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to initialize Stripe:', error);
      this.stripe = null;
      return false;
    }
  }

  /**
   * Inicializa ou reinicializa o MercadoPago com o token do banco ou env
   */
  async initializeMercadoPago(): Promise<boolean> {
    try {
      // Primeiro tenta buscar do banco de dados
      let mpToken: string | null | undefined = await this.settingsService.get<string>(
        'mercadopago_access_token',
      );

      // Fallback para variável de ambiente
      if (!mpToken) {
        mpToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? null;
      }

      if (mpToken && mpToken.trim() !== '') {
        this.mercadopago = new MercadoPagoConfig({
          accessToken: mpToken,
        });
        this.mpAccessToken = mpToken;
        this.logger.log('MercadoPago initialized successfully');
        return true;
      } else {
        this.mercadopago = null;
        this.mpAccessToken = null;
        this.logger.warn('MercadoPago not configured - no access token found');
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to initialize MercadoPago:', error);
      this.mercadopago = null;
      return false;
    }
  }

  /**
   * Reinicializa todos os gateways (chamado quando configurações são atualizadas)
   * Now delegates to GatewayRegistry
   */
  async reinitializeGateways(): Promise<{ stripe: boolean; mercadopago: boolean }> {
    // Legacy initialization for backwards compatibility
    const stripeOk = await this.initializeStripe();
    const mpOk = await this.initializeMercadoPago();

    // Also reinitialize via registry for new gateway implementations
    await this.gatewayRegistry.reinitializeGateways();

    return { stripe: stripeOk, mercadopago: mpOk };
  }

  /**
   * Retorna o status atual dos gateways
   * Now delegates to GatewayRegistry
   */
  async getGatewayStatus(): Promise<{
    stripe: { configured: boolean; enabled: boolean };
    mercadopago: { configured: boolean; enabled: boolean };
  }> {
    // Use registry for status
    const registryStatus = await this.gatewayRegistry.getStatus();

    return {
      stripe: {
        configured: registryStatus.stripe?.configured ?? !!this.stripe,
        enabled: registryStatus.stripe?.enabled ?? false,
      },
      mercadopago: {
        configured: registryStatus.mercadopago?.configured ?? !!this.mercadopago,
        enabled: registryStatus.mercadopago?.enabled ?? false,
      },
    };
  }

  /**
   * Obtém o token do MercadoPago para uso interno
   */
  getMercadoPagoAccessToken(): string | null {
    return this.mpAccessToken;
  }

  async getAvailablePaymentMethods() {
    // Delegate to GatewayRegistry for available methods
    return this.gatewayRegistry.getAvailablePaymentMethods();
  }

  /**
   * Check if Stripe gateway is enabled
   */
  async isStripeEnabled(): Promise<boolean> {
    return this.stripeGateway.isEnabled();
  }

  /**
   * Check if Mercado Pago gateway is enabled
   */
  async isMercadoPagoEnabled(): Promise<boolean> {
    return this.mercadoPagoGateway.isEnabled();
  }

  /**
   * Get the configured card gateway (stripe, mercadopago, or both)
   */
  async getCardGateway(): Promise<string> {
    const gateway = await this.settingsService.get<string>('card_gateway');
    return gateway ?? 'both';
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
    this.logger.log(`Processing card payment for order ${order.id}, amount: ${amount}`);
    this.logger.log(
      `Card data present: ${!!dto.cardData}, Card token present: ${!!dto.cardToken}, Saved card: ${!!dto.savedCardId}`,
    );

    // If using a saved card, check the provider and delegate accordingly
    if (dto.savedCardId) {
      const savedCard = await this.prisma.savedCard.findUnique({
        where: { id: dto.savedCardId },
      });

      if (!savedCard) {
        throw new BadRequestException('Cartão não encontrado');
      }

      // Route to correct payment provider
      if (savedCard.provider === CardProvider.STRIPE) {
        return this.processPaymentWithStripeCard(order, dto.savedCardId, amount);
      } else {
        return this.processPaymentWithSavedCard(
          order,
          dto.savedCardId,
          dto.securityCode || '',
          amount,
        );
      }
    }

    // Validate required card data fields
    if (dto.cardData) {
      if (!dto.cardData.identificationNumber) {
        this.logger.error('Missing identificationNumber (CPF) in card data');
        throw new BadRequestException('CPF é obrigatório para pagamento com cartão');
      }
      this.logger.log(`Card brand detection for: ${dto.cardData.cardNumber?.substring(0, 6)}****`);
    }

    // Try MercadoPago first (better for Brazilian cards)
    if (this.mercadopago && (dto.cardToken || dto.cardData)) {
      try {
        const payment = new Payment(this.mercadopago);

        // Detect card brand from card number
        const cardBrand = dto.cardData ? this.detectCardBrand(dto.cardData.cardNumber) : 'master';

        // Build payment body
        const paymentBody: any = {
          transaction_amount: amount,
          description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
          installments: 1,
          payment_method_id: cardBrand,
          payer: {
            email: order.customer?.user?.email || 'customer@zefood.com',
            identification: dto.cardData
              ? {
                  type: dto.cardData.identificationType || 'CPF',
                  number: dto.cardData.identificationNumber,
                }
              : undefined,
          },
          metadata: {
            order_id: order.id,
          },
        };

        // If we have raw card data (transparent checkout)
        if (dto.cardData) {
          const accessToken = this.mpAccessToken;
          if (!accessToken) {
            throw new BadRequestException('MercadoPago não configurado');
          }
          const cardBin = dto.cardData.cardNumber.replace(/\s/g, '').substring(0, 6);

          // First, get the correct payment_method_id from MercadoPago BIN API
          this.logger.log(`Querying MercadoPago BIN API for: ${cardBin}`);
          const binResponse = await fetch(
            `https://api.mercadopago.com/v1/payment_methods/search?bins=${cardBin}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );

          const binData = await binResponse.json();
          this.logger.log(`BIN API response: ${JSON.stringify(binData, null, 2)}`);

          let paymentMethodId = cardBrand; // fallback to detected brand
          if (binData.results && binData.results.length > 0) {
            paymentMethodId = binData.results[0].id;
            this.logger.log(`BIN API returned payment_method_id: ${paymentMethodId}`);
          } else {
            this.logger.warn(`BIN API returned no results, using detected brand: ${cardBrand}`);
          }

          // Update payment body with correct payment_method_id
          paymentBody.payment_method_id = paymentMethodId;

          // Create card token via MercadoPago API
          const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              card_number: dto.cardData.cardNumber,
              cardholder: {
                name: dto.cardData.cardholderName,
                identification: {
                  type: dto.cardData.identificationType || 'CPF',
                  number: dto.cardData.identificationNumber,
                },
              },
              expiration_month: parseInt(dto.cardData.expirationMonth),
              expiration_year: parseInt(
                dto.cardData.expirationYear.length === 2
                  ? `20${dto.cardData.expirationYear}`
                  : dto.cardData.expirationYear,
              ),
              security_code: dto.cardData.securityCode,
            }),
          });

          const tokenData = await tokenResponse.json();

          if (!tokenResponse.ok || !tokenData.id) {
            this.logger.error('Failed to create card token:', JSON.stringify(tokenData, null, 2));
            this.logger.error('Token response status:', tokenResponse.status);
            this.logger.error(
              'Token request body:',
              JSON.stringify(
                {
                  card_number: dto.cardData.cardNumber
                    ? `${dto.cardData.cardNumber.substring(0, 6)}****`
                    : 'missing',
                  cardholder_name: dto.cardData.cardholderName,
                  identification_type: dto.cardData.identificationType,
                  identification_number: dto.cardData.identificationNumber,
                  expiration_month: dto.cardData.expirationMonth,
                  expiration_year: dto.cardData.expirationYear,
                },
                null,
                2,
              ),
            );

            // Return more detailed error
            const errorMessage =
              tokenData.cause?.[0]?.description ||
              tokenData.message ||
              'Erro ao processar dados do cartão';
            throw new BadRequestException(errorMessage);
          }

          paymentBody.token = tokenData.id;
          this.logger.log(
            `Card token created: ${tokenData.id}, using payment_method_id: ${paymentMethodId}`,
          );
        } else if (dto.cardToken) {
          // Use pre-generated token
          paymentBody.token = dto.cardToken;
        }

        const result = await payment.create({ body: paymentBody });

        const status = this.mapMercadoPagoStatus(result.status);

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            paymentId: result.id?.toString(),
            paymentStatus: status,
            paymentMethod: dto.method,
          },
        });

        if (status === PaymentStatus.FAILED) {
          const errorDetail = result.status_detail || 'Pagamento recusado';
          throw new BadRequestException(this.translateMercadoPagoError(errorDetail));
        }

        // Notify restaurant when payment is confirmed
        if (status === PaymentStatus.PAID) {
          this.notifyRestaurantNewOrder(order.id);
        }

        return {
          success: status === PaymentStatus.PAID,
          paymentId: result.id?.toString(),
          status,
        };
      } catch (error: any) {
        this.logger.error('MercadoPago card payment error:', error);
        if (error instanceof BadRequestException) {
          throw error;
        }
        const errorMessage = error?.message || 'Erro ao processar pagamento';
        throw new BadRequestException(errorMessage);
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

  private detectCardBrand(cardNumber: string): string {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const bin = cleanNumber.substring(0, 6);

    this.logger.log(`Detecting card brand for BIN: ${bin}`);

    // Elo - extensive BIN ranges (must check before Visa/Master due to overlaps)
    const eloBins = [
      '401178',
      '401179',
      '431274',
      '438935',
      '451416',
      '457393',
      '457631',
      '457632',
      '504175',
      '506699',
      '506700',
      '506701',
      '506702',
      '506703',
      '506704',
      '506705',
      '506706',
      '506707',
      '506708',
      '506709',
      '506710',
      '506711',
      '506712',
      '506713',
      '506714',
      '506715',
      '506716',
      '506717',
      '506718',
      '506719',
      '506720',
      '506721',
      '506722',
      '506723',
      '506724',
      '506725',
      '506726',
      '506727',
      '506728',
      '506729',
      '506730',
      '506731',
      '506732',
      '506733',
      '506734',
      '506735',
      '506736',
      '506737',
      '506738',
      '506739',
      '506740',
      '506741',
      '506742',
      '506743',
      '506744',
      '506745',
      '506746',
      '506747',
      '506748',
      '506749',
      '506750',
      '506751',
      '506752',
      '506753',
      '506754',
      '506755',
      '506756',
      '506757',
      '506758',
      '506759',
      '506760',
      '506761',
      '506762',
      '506763',
      '506764',
      '506765',
      '506766',
      '506767',
      '506768',
      '506769',
      '506770',
      '506771',
      '506772',
      '506773',
      '506774',
      '506775',
      '506776',
      '506777',
      '506778',
      '509000',
      '509001',
      '509002',
      '509003',
      '509004',
      '509005',
      '509006',
      '509007',
      '509008',
      '509009',
      '509010',
      '509011',
      '509012',
      '509013',
      '509014',
      '509015',
      '509016',
      '509017',
      '509018',
      '509019',
      '509020',
      '509021',
      '509022',
      '509023',
      '509024',
      '509025',
      '509026',
      '509027',
      '509028',
      '509029',
      '509030',
      '509031',
      '509032',
      '509033',
      '509034',
      '509035',
      '509036',
      '509037',
      '509038',
      '509039',
      '509040',
      '509041',
      '509042',
      '509043',
      '509044',
      '509045',
      '509046',
      '509047',
      '509048',
      '509049',
      '509050',
      '509051',
      '509052',
      '509053',
      '509054',
      '509055',
      '509056',
      '509057',
      '509058',
      '509059',
      '509060',
      '509061',
      '509062',
      '509063',
      '509064',
      '509065',
      '509066',
      '509067',
      '509068',
      '509069',
      '509070',
      '509071',
      '509072',
      '509073',
      '509074',
      '509075',
      '509076',
      '509077',
      '509078',
      '509079',
      '509080',
      '509081',
      '509082',
      '509083',
      '509084',
      '509085',
      '509086',
      '509087',
      '509088',
      '509089',
      '509090',
      '509091',
      '509092',
      '509093',
      '509094',
      '509095',
      '509096',
      '509097',
      '509098',
      '509099',
      '627780',
      '636297',
      '636368',
      '650031',
      '650032',
      '650033',
      '650034',
      '650035',
      '650036',
      '650037',
      '650038',
      '650039',
      '650040',
      '650041',
      '650042',
      '650043',
      '650044',
      '650045',
      '650046',
      '650047',
      '650048',
      '650049',
      '650050',
      '650051',
      '650052',
      '650053',
      '650054',
      '650055',
      '650056',
      '650057',
      '650058',
      '650059',
      '650060',
      '650061',
      '650062',
      '650063',
      '650064',
      '650065',
      '650066',
      '650067',
      '650068',
      '650069',
      '650070',
      '650071',
      '650072',
      '650073',
      '650074',
      '650075',
      '650076',
      '650077',
      '650078',
      '655000',
      '655001',
      '655002',
      '655003',
      '655004',
      '655005',
      '655006',
      '655007',
    ];

    // Check Elo by exact BIN match
    if (eloBins.includes(bin)) {
      this.logger.log(`Detected card brand: elo (exact BIN match)`);
      return 'elo';
    }

    // Mercado Pago test cards - must check before Elo pattern
    // Test Mastercard: 5031 4332 1540 6351 (BIN 503143)
    if (bin === '503143') {
      this.logger.log(`Detected card brand: master (MP test card)`);
      return 'master';
    }

    // Elo ranges that start with specific patterns (excluding 503143 which is MP test)
    if (/^(5067|4576|4011|5090|6277|6363|6500|6550)/.test(cleanNumber)) {
      this.logger.log(`Detected card brand: elo (pattern match)`);
      return 'elo';
    }

    // Hipercard
    if (/^(606282|3841|637095|637612|637568|637599|637609|637599)/.test(cleanNumber)) {
      this.logger.log(`Detected card brand: hipercard`);
      return 'hipercard';
    }

    // American Express
    if (/^3[47]/.test(cleanNumber)) {
      this.logger.log(`Detected card brand: amex`);
      return 'amex';
    }

    // Visa
    if (/^4/.test(cleanNumber)) {
      this.logger.log(`Detected card brand: visa`);
      return 'visa';
    }

    // Mastercard
    if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) {
      this.logger.log(`Detected card brand: master`);
      return 'master';
    }

    // Default to visa (most common)
    this.logger.log(`Detected card brand: visa (default)`);
    return 'visa';
  }

  private translateMercadoPagoError(statusDetail: string): string {
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
    };

    return errorMessages[statusDetail] || 'Pagamento recusado. Tente novamente.';
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
    // Get PIX settings from database, fallback to env/defaults
    let pixKey = await this.settingsService.get<string>('pix_key');
    if (!pixKey) {
      pixKey = this.configService.get<string>('PIX_KEY') || 'zefood@pix.com';
    }

    const merchantName = (
      await this.settingsService.get<string>('pix_merchant_name') ||
      order.restaurant.name ||
      'ZeFood'
    ).substring(0, 25);

    const city = (
      await this.settingsService.get<string>('pix_merchant_city') ||
      order.restaurant.city ||
      'SAO PAULO'
    ).substring(0, 15);

    const expirationMinutes = await this.settingsService.get<number>('pix_expiration_minutes') || 30;
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
      expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000),
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
    const payloadWithoutCRC =
      payloadFormat +
      merchantAccount +
      mcc +
      currency +
      amount +
      country +
      merchantName +
      city +
      additionalData +
      '6304';

    // Calculate CRC16
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

  // Stripe Payment Intent creation for frontend
  async createStripePaymentIntent(
    orderId: string,
    userId: string,
  ): Promise<{ clientSecret: string }> {
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
  async createMercadoPagoPreference(
    orderId: string,
    userId: string,
  ): Promise<{ preferenceId: string; initPoint: string }> {
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
        items: order.items.map((item) => ({
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

    // First try from database, fallback to env
    let webhookSecret = await this.settingsService.get<string>('stripe_webhook_secret');
    if (!webhookSecret) {
      webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? null;
    }
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

        // Notify restaurant when payment is confirmed via webhook
        if (status === PaymentStatus.PAID) {
          this.notifyRestaurantNewOrder(orderId);
        }

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

    // Notify restaurant when payment is confirmed via Stripe webhook
    this.notifyRestaurantNewOrder(orderId);

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

    // Notify restaurant when payment is simulated
    this.notifyRestaurantNewOrder(orderId);

    this.logger.log(`Simulated payment confirmation for order ${orderId}`);
  }

  // ==================== SAVED CARDS (MP Customer API) ====================

  /**
   * Get or create a MercadoPago customer for the given user
   */
  async getOrCreateMPCustomer(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    // If already has MP customer ID, return it
    if (customer.mpCustomerId) {
      return customer.mpCustomerId;
    }

    // Create a new MP customer
    const accessToken = this.mpAccessToken;
    if (!accessToken) {
      throw new BadRequestException('MercadoPago não configurado');
    }

    try {
      const response = await fetch('https://api.mercadopago.com/v1/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: customer.user.email,
          first_name: customer.fullName?.split(' ')[0] || 'Customer',
          last_name: customer.fullName?.split(' ').slice(1).join(' ') || '',
          identification: customer.cpf
            ? {
                type: 'CPF',
                number: customer.cpf,
              }
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if customer already exists with this email
        if (
          data.cause?.[0]?.code === 'customer_already_exists' ||
          data.message?.includes('already exists')
        ) {
          // Search for existing customer
          const searchResponse = await fetch(
            `https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(customer.user.email)}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );
          const searchData = await searchResponse.json();

          if (searchData.results?.[0]?.id) {
            const mpCustomerId = searchData.results[0].id;
            await this.prisma.customer.update({
              where: { id: customer.id },
              data: { mpCustomerId },
            });
            return mpCustomerId;
          }
        }
        this.logger.error('Failed to create MP customer:', data);
        throw new BadRequestException('Erro ao criar cliente no MercadoPago');
      }

      // Save MP customer ID to database
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { mpCustomerId: data.id },
      });

      this.logger.log(`Created MP customer ${data.id} for user ${userId}`);
      return data.id;
    } catch (error: any) {
      this.logger.error('Error creating MP customer:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Erro ao criar cliente no MercadoPago');
    }
  }

  /**
   * List saved cards for a user
   */
  async getSavedCards(userId: string): Promise<SavedCardDto[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { savedCards: true },
    });

    if (!customer) {
      return [];
    }

    return customer.savedCards.map((card) => ({
      id: card.id,
      provider: card.provider,
      mpCardId: card.mpCardId || undefined,
      stripePaymentMethodId: card.stripePaymentMethodId || undefined,
      lastFourDigits: card.lastFourDigits,
      expirationMonth: card.expirationMonth,
      expirationYear: card.expirationYear,
      cardholderName: card.cardholderName,
      brand: card.brand,
      isDefault: card.isDefault,
    }));
  }

  /**
   * Save a new card via MP Customer API
   */
  async saveCard(userId: string, cardData: CardDataInput): Promise<SavedCardDto> {
    const accessToken = this.mpAccessToken;
    if (!accessToken) {
      throw new BadRequestException('MercadoPago não configurado');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    // Get or create MP customer
    const mpCustomerId = await this.getOrCreateMPCustomer(userId);

    try {
      // First create a card token
      const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
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

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.id) {
        this.logger.error('Failed to create card token for saving:', tokenData);
        throw new BadRequestException(
          tokenData.cause?.[0]?.description || 'Erro ao processar dados do cartão',
        );
      }

      // Now add the card to the customer
      const cardResponse = await fetch(
        `https://api.mercadopago.com/v1/customers/${mpCustomerId}/cards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            token: tokenData.id,
          }),
        },
      );

      const mpCardData = await cardResponse.json();
      if (!cardResponse.ok || !mpCardData.id) {
        this.logger.error('Failed to save card to MP customer:', mpCardData);
        throw new BadRequestException(mpCardData.message || 'Erro ao salvar cartão');
      }

      // Check if this is the first card (make it default)
      const existingCards = await this.prisma.savedCard.count({
        where: { customerId: customer.id },
      });

      // Save card to our database
      const savedCard = await this.prisma.savedCard.create({
        data: {
          customerId: customer.id,
          provider: CardProvider.MERCADOPAGO,
          mpCardId: mpCardData.id,
          lastFourDigits: mpCardData.last_four_digits,
          expirationMonth: mpCardData.expiration_month,
          expirationYear: mpCardData.expiration_year,
          cardholderName: mpCardData.cardholder?.name || cardData.cardholderName,
          brand: mpCardData.payment_method?.id || this.detectCardBrand(cardData.cardNumber),
          paymentMethodId: mpCardData.payment_method?.id || 'credit_card',
          isDefault: existingCards === 0,
        },
      });

      this.logger.log(
        `Saved card ${savedCard.id} (MP: ${mpCardData.id}) for customer ${customer.id}`,
      );

      return {
        id: savedCard.id,
        provider: savedCard.provider,
        mpCardId: savedCard.mpCardId || undefined,
        lastFourDigits: savedCard.lastFourDigits,
        expirationMonth: savedCard.expirationMonth,
        expirationYear: savedCard.expirationYear,
        cardholderName: savedCard.cardholderName,
        brand: savedCard.brand,
        isDefault: savedCard.isDefault,
      };
    } catch (error: any) {
      this.logger.error('Error saving card:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Erro ao salvar cartão');
    }
  }

  /**
   * Delete a saved card
   */
  async deleteCard(userId: string, cardId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: cardId,
        customerId: customer.id,
      },
    });

    if (!savedCard) {
      throw new BadRequestException('Card not found');
    }

    const accessToken = this.mpAccessToken;

    // Delete from MercadoPago if we have customer ID
    if (customer.mpCustomerId && accessToken) {
      try {
        await fetch(
          `https://api.mercadopago.com/v1/customers/${customer.mpCustomerId}/cards/${savedCard.mpCardId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
      } catch (error) {
        this.logger.warn('Failed to delete card from MP:', error);
        // Continue anyway - delete from our DB
      }
    }

    // Delete from our database
    await this.prisma.savedCard.delete({
      where: { id: cardId },
    });

    // If this was the default card, make another card default
    if (savedCard.isDefault) {
      const nextCard = await this.prisma.savedCard.findFirst({
        where: { customerId: customer.id },
      });
      if (nextCard) {
        await this.prisma.savedCard.update({
          where: { id: nextCard.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Deleted card ${cardId} for customer ${customer.id}`);
  }

  /**
   * Set a card as default
   */
  async setDefaultCard(userId: string, cardId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: cardId,
        customerId: customer.id,
      },
    });

    if (!savedCard) {
      throw new BadRequestException('Card not found');
    }

    // Remove default from all cards
    await this.prisma.savedCard.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false },
    });

    // Set this card as default
    await this.prisma.savedCard.update({
      where: { id: cardId },
      data: { isDefault: true },
    });
  }

  /**
   * Process payment with saved card
   */
  private async processPaymentWithSavedCard(
    order: any,
    savedCardId: string,
    securityCode: string,
    amount: number,
  ): Promise<PaymentResult> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: order.customerId },
      include: { user: true },
    });

    if (!customer?.mpCustomerId) {
      throw new BadRequestException('Cliente não possui cartões salvos');
    }

    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: savedCardId,
        customerId: customer.id,
      },
    });

    if (!savedCard) {
      throw new BadRequestException('Cartão não encontrado');
    }

    // Validate it's a Mercado Pago card with mpCardId
    if (!savedCard.mpCardId) {
      throw new BadRequestException('Cartão inválido para pagamento via Mercado Pago');
    }

    if (!this.mpAccessToken) {
      throw new BadRequestException('MercadoPago não configurado');
    }

    try {
      // Create payment with saved card using MP Customer API
      const payment = new Payment(this.mercadopago!);

      const result = await payment.create({
        body: {
          transaction_amount: amount,
          description: `Pedido #${order.id.slice(0, 8)} - ${order.restaurant.name}`,
          installments: 1,
          payment_method_id: savedCard.brand,
          token: savedCard.mpCardId!, // Use the saved card ID as token (already validated above)
          payer: {
            id: customer.mpCustomerId,
            email: customer.user.email,
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
        },
      });

      if (status === PaymentStatus.FAILED) {
        const errorDetail = result.status_detail || 'Pagamento recusado';
        throw new BadRequestException(this.translateMercadoPagoError(errorDetail));
      }

      if (status === PaymentStatus.PAID) {
        this.notifyRestaurantNewOrder(order.id);
      }

      return {
        success: status === PaymentStatus.PAID,
        paymentId: result.id?.toString(),
        status,
      };
    } catch (error: any) {
      this.logger.error('Payment with saved card error:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Erro ao processar pagamento com cartão salvo');
    }
  }

  // ==================== STRIPE CUSTOMER & CARDS ====================

  /**
   * Get or create a Stripe customer for the given user
   */
  async getOrCreateStripeCustomer(userId: string): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe não configurado');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    // If already has Stripe customer ID, return it
    if (customer.stripeCustomerId) {
      return customer.stripeCustomerId;
    }

    // Create a new Stripe customer
    try {
      const stripeCustomer = await this.stripe.customers.create({
        email: customer.user.email,
        name: customer.fullName,
        metadata: {
          userId: userId,
          customerId: customer.id,
        },
      });

      // Save Stripe customer ID to database
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { stripeCustomerId: stripeCustomer.id },
      });

      this.logger.log(`Created Stripe customer ${stripeCustomer.id} for user ${userId}`);
      return stripeCustomer.id;
    } catch (error: any) {
      this.logger.error('Error creating Stripe customer:', error);
      throw new BadRequestException('Erro ao criar cliente no Stripe');
    }
  }

  /**
   * Create a SetupIntent for saving a card with Stripe
   * Frontend uses this to collect card details securely
   */
  async createStripeSetupIntent(
    userId: string,
  ): Promise<{ clientSecret: string; customerId: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe não configurado');
    }

    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId);

    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session', // Allows charging without user present
      });

      this.logger.log(
        `Created Stripe SetupIntent ${setupIntent.id} for customer ${stripeCustomerId}`,
      );

      return {
        clientSecret: setupIntent.client_secret!,
        customerId: stripeCustomerId,
      };
    } catch (error: any) {
      this.logger.error('Error creating Stripe SetupIntent:', error);
      throw new BadRequestException('Erro ao iniciar salvamento de cartão');
    }
  }

  /**
   * Confirm and save a Stripe card after SetupIntent completes
   * Called from frontend after Stripe.js confirms the SetupIntent
   */
  async confirmStripeCardSaved(userId: string, paymentMethodId: string): Promise<SavedCardDto> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe não configurado');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer || !customer.stripeCustomerId) {
      throw new BadRequestException('Customer not found or not linked to Stripe');
    }

    try {
      // Fetch the PaymentMethod details from Stripe
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

      if (!paymentMethod.card) {
        throw new BadRequestException('PaymentMethod não é um cartão');
      }

      // Check if this is the first card (make it default)
      const existingCards = await this.prisma.savedCard.count({
        where: { customerId: customer.id },
      });

      // Save card to our database
      const savedCard = await this.prisma.savedCard.create({
        data: {
          customerId: customer.id,
          provider: CardProvider.STRIPE,
          stripePaymentMethodId: paymentMethodId,
          lastFourDigits: paymentMethod.card.last4,
          expirationMonth: paymentMethod.card.exp_month,
          expirationYear: paymentMethod.card.exp_year,
          cardholderName: paymentMethod.billing_details?.name || 'Titular',
          brand: paymentMethod.card.brand,
          paymentMethodId: paymentMethodId,
          isDefault: existingCards === 0,
        },
      });

      this.logger.log(
        `Saved Stripe card ${savedCard.id} (PM: ${paymentMethodId}) for customer ${customer.id}`,
      );

      return {
        id: savedCard.id,
        provider: savedCard.provider,
        stripePaymentMethodId: savedCard.stripePaymentMethodId || undefined,
        lastFourDigits: savedCard.lastFourDigits,
        expirationMonth: savedCard.expirationMonth,
        expirationYear: savedCard.expirationYear,
        cardholderName: savedCard.cardholderName,
        brand: savedCard.brand,
        isDefault: savedCard.isDefault,
      };
    } catch (error: any) {
      this.logger.error('Error confirming Stripe card:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Erro ao salvar cartão do Stripe');
    }
  }

  /**
   * Process payment with saved Stripe card (1-click, no CVV needed!)
   */
  async processPaymentWithStripeCard(
    order: any,
    savedCardId: string,
    amount: number,
  ): Promise<PaymentResult> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe não configurado');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: order.customerId },
      include: { user: true },
    });

    if (!customer?.stripeCustomerId) {
      throw new BadRequestException('Cliente não possui conta Stripe');
    }

    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: savedCardId,
        customerId: customer.id,
        provider: CardProvider.STRIPE,
      },
    });

    if (!savedCard || !savedCard.stripePaymentMethodId) {
      throw new BadRequestException('Cartão Stripe não encontrado');
    }

    try {
      // Create PaymentIntent and charge immediately (off_session = no user interaction)
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: 'brl',
        customer: customer.stripeCustomerId,
        payment_method: savedCard.stripePaymentMethodId,
        off_session: true, // 1-click payment - no CVV needed!
        confirm: true, // Charge immediately
        metadata: {
          orderId: order.id,
          savedCardId: savedCard.id,
        },
      });

      const status = this.mapStripeStatus(paymentIntent.status);

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentId: paymentIntent.id,
          paymentStatus: status,
        },
      });

      if (status === PaymentStatus.PAID) {
        this.notifyRestaurantNewOrder(order.id);
      }

      this.logger.log(`Stripe 1-click payment ${paymentIntent.id} status: ${status}`);

      return {
        success: status === PaymentStatus.PAID,
        paymentId: paymentIntent.id,
        status,
      };
    } catch (error: any) {
      this.logger.error('Stripe saved card payment error:', error);

      // Handle specific Stripe errors
      if (error.code === 'authentication_required') {
        throw new BadRequestException(
          'Autenticação adicional necessária. Tente pagar com o cartão novamente.',
        );
      }

      throw new BadRequestException(
        error.message || 'Erro ao processar pagamento com cartão salvo',
      );
    }
  }

  /**
   * Delete a Stripe saved card
   */
  async deleteStripeCard(userId: string, cardId: string): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe não configurado');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const savedCard = await this.prisma.savedCard.findFirst({
      where: {
        id: cardId,
        customerId: customer.id,
        provider: CardProvider.STRIPE,
      },
    });

    if (!savedCard) {
      throw new BadRequestException('Cartão não encontrado');
    }

    // Detach PaymentMethod from Stripe customer
    if (savedCard.stripePaymentMethodId) {
      try {
        await this.stripe.paymentMethods.detach(savedCard.stripePaymentMethodId);
        this.logger.log(`Detached Stripe PaymentMethod ${savedCard.stripePaymentMethodId}`);
      } catch (error) {
        this.logger.warn('Failed to detach Stripe PaymentMethod:', error);
        // Continue anyway - delete from our DB
      }
    }

    // Delete from our database
    await this.prisma.savedCard.delete({
      where: { id: cardId },
    });

    // If this was the default card, make another card default
    if (savedCard.isDefault) {
      const nextCard = await this.prisma.savedCard.findFirst({
        where: { customerId: customer.id },
      });
      if (nextCard) {
        await this.prisma.savedCard.update({
          where: { id: nextCard.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Deleted Stripe card ${cardId} for customer ${customer.id}`);
  }

  /**
   * Get Stripe publishable key for frontend
   */
  async getStripePublishableKey(): Promise<string> {
    // First try from database settings
    let key = await this.settingsService.get<string>('stripe_public_key');

    // Fallback to env
    if (!key) {
      key = this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? null;
    }

    if (!key) {
      throw new BadRequestException('Stripe não configurado');
    }
    return key;
  }

  // Notify restaurant about new paid order via WebSocket
  private async notifyRestaurantNewOrder(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
          restaurant: true,
          customer: true,
        },
      });

      if (order) {
        this.ordersGateway.emitNewOrder(order);
        this.logger.log(
          `Notified restaurant ${order.restaurantId} about new paid order ${orderId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to notify restaurant about order ${orderId}:`, error);
    }
  }
}
