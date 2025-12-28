import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PaymentGateway } from '../interfaces';
import { StripeGateway } from './stripe/stripe.gateway';
import { MercadoPagoGateway } from './mercadopago/mercadopago.gateway';
import { SettingsService } from '../../settings/settings.service';

/**
 * Registry for payment gateways.
 * Manages gateway discovery, initialization, and selection.
 *
 * @example
 * ```typescript
 * // Get a specific gateway
 * const stripe = registry.get('stripe');
 *
 * // Get all enabled gateways
 * const enabled = await registry.getEnabled();
 *
 * // Select best gateway for payment
 * const gateway = await registry.selectGateway('stripe');
 * ```
 */
@Injectable()
export class GatewayRegistry implements OnModuleInit {
  private readonly logger = new Logger(GatewayRegistry.name);
  private gateways: Map<string, PaymentGateway> = new Map();

  constructor(
    private readonly stripeGateway: StripeGateway,
    private readonly mercadoPagoGateway: MercadoPagoGateway,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Initialize all gateways on module startup
   */
  async onModuleInit() {
    await this.initializeAllGateways();
  }

  /**
   * Initialize all registered gateways
   */
  async initializeAllGateways(): Promise<void> {
    this.logger.log('Initializing payment gateways...');

    // Register and initialize Stripe
    await this.stripeGateway.initialize();
    this.register(this.stripeGateway);

    // Register and initialize MercadoPago
    await this.mercadoPagoGateway.initialize();
    this.register(this.mercadoPagoGateway);

    const configured = this.getConfigured();
    this.logger.log(`Payment gateways initialized. Configured: ${configured.map((g) => g.name).join(', ') || 'none'}`);
  }

  /**
   * Reinitialize all gateways (called when settings are updated)
   */
  async reinitializeGateways(): Promise<{ [key: string]: boolean }> {
    this.logger.log('Reinitializing payment gateways...');

    const results: { [key: string]: boolean } = {};

    await this.stripeGateway.initialize();
    results.stripe = this.stripeGateway.isConfigured();

    await this.mercadoPagoGateway.initialize();
    results.mercadopago = this.mercadoPagoGateway.isConfigured();

    return results;
  }

  /**
   * Register a gateway
   */
  register(gateway: PaymentGateway): void {
    this.gateways.set(gateway.name, gateway);
    this.logger.debug(`Registered gateway: ${gateway.name}`);
  }

  /**
   * Unregister a gateway
   */
  unregister(name: string): void {
    this.gateways.delete(name);
  }

  /**
   * Get a gateway by name
   */
  get(name: string): PaymentGateway | undefined {
    return this.gateways.get(name);
  }

  /**
   * Get all registered gateways
   */
  getAll(): PaymentGateway[] {
    return Array.from(this.gateways.values());
  }

  /**
   * Get all configured gateways (have valid credentials)
   */
  getConfigured(): PaymentGateway[] {
    return this.getAll().filter((g) => g.isConfigured());
  }

  /**
   * Get all enabled gateways (configured AND enabled in settings)
   */
  async getEnabled(): Promise<PaymentGateway[]> {
    const configured = this.getConfigured();
    const enabled: PaymentGateway[] = [];

    for (const gateway of configured) {
      if (await gateway.isEnabled()) {
        enabled.push(gateway);
      }
    }

    return enabled;
  }

  /**
   * Get status of all gateways
   */
  async getStatus(): Promise<{
    [name: string]: { configured: boolean; enabled: boolean; displayName: string };
  }> {
    const status: {
      [name: string]: { configured: boolean; enabled: boolean; displayName: string };
    } = {};

    for (const gateway of this.getAll()) {
      status[gateway.name] = {
        configured: gateway.isConfigured(),
        enabled: await gateway.isEnabled(),
        displayName: gateway.displayName,
      };
    }

    return status;
  }

  /**
   * Select the best gateway based on preference and availability
   *
   * @param preference - Preferred gateway name (optional)
   * @returns The selected gateway or undefined if none available
   */
  async selectGateway(preference?: string): Promise<PaymentGateway | undefined> {
    const enabled = await this.getEnabled();

    if (enabled.length === 0) {
      this.logger.warn('No enabled payment gateways available');
      return undefined;
    }

    // If preference is specified, try to use it
    if (preference) {
      const preferred = enabled.find((g) => g.name === preference);
      if (preferred) {
        return preferred;
      }
      this.logger.warn(`Preferred gateway ${preference} not available, falling back`);
    }

    // Get default gateway from settings
    const defaultGateway = await this.settingsService.get<string>('card_gateway');

    if (defaultGateway && defaultGateway !== 'both') {
      const defaultG = enabled.find((g) => g.name === defaultGateway);
      if (defaultG) {
        return defaultG;
      }
    }

    // Return first available
    return enabled[0];
  }

  /**
   * Select gateway for card payments based on settings
   */
  async selectCardGateway(): Promise<PaymentGateway | undefined> {
    const cardGateway = await this.settingsService.get<string>('card_gateway');
    return this.selectGateway(cardGateway === 'both' ? undefined : (cardGateway ?? undefined));
  }

  /**
   * Check if any gateway is available for card payments
   */
  async hasCardPayment(): Promise<boolean> {
    const cardEnabled = await this.settingsService.get<boolean>('card_enabled');
    if (!cardEnabled) return false;

    const enabled = await this.getEnabled();
    return enabled.some((g) => g.supportsFeature('credit_card'));
  }

  /**
   * Check if PIX is available
   */
  async hasPixPayment(): Promise<boolean> {
    const pixEnabled = await this.settingsService.get<boolean>('pix_enabled');
    if (!pixEnabled) return false;

    const enabled = await this.getEnabled();
    return enabled.some((g) => g.supportsFeature('pix'));
  }

  /**
   * Get gateway that supports PIX
   */
  async getPixGateway(): Promise<PaymentGateway | undefined> {
    const enabled = await this.getEnabled();
    return enabled.find((g) => g.supportsFeature('pix'));
  }

  /**
   * Get available payment methods based on enabled gateways
   */
  async getAvailablePaymentMethods(): Promise<{
    methods: Array<{ value: string; label: string; icon: string; available: boolean }>;
    hasCardPayment: boolean;
    enabledGateways: { [key: string]: boolean };
  }> {
    const pixEnabled = (await this.settingsService.get<boolean>('pix_enabled')) ?? true;
    const cardEnabled = (await this.settingsService.get<boolean>('card_enabled')) ?? true;
    const cashEnabled = (await this.settingsService.get<boolean>('cash_enabled')) ?? true;

    const enabledGateways = await this.getEnabled();
    const gatewayStatus: { [key: string]: boolean } = {};

    for (const g of this.getAll()) {
      gatewayStatus[g.name] = enabledGateways.some((eg) => eg.name === g.name);
    }

    const hasCardPayment = cardEnabled && enabledGateways.some((g) => g.supportsFeature('credit_card'));
    const hasPixPayment = pixEnabled && enabledGateways.some((g) => g.supportsFeature('pix'));

    const methods = [
      {
        value: 'PIX',
        label: 'Pix',
        icon: '💠',
        available: hasPixPayment,
      },
      {
        value: 'CREDIT_CARD',
        label: 'Cartão de crédito',
        icon: '💳',
        available: hasCardPayment,
      },
      {
        value: 'DEBIT_CARD',
        label: 'Cartão de débito',
        icon: '💳',
        available: hasCardPayment,
      },
      {
        value: 'CASH',
        label: 'Dinheiro',
        icon: '💵',
        available: cashEnabled,
      },
    ];

    return {
      methods,
      hasCardPayment,
      enabledGateways: gatewayStatus,
    };
  }
}
