import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Default settings with categories
const DEFAULT_SETTINGS = [
  // Delivery Settings
  {
    key: 'delivery_base_fee',
    value: '5.00',
    type: 'NUMBER',
    category: 'delivery',
    label: 'Taxa Base de Entrega',
    description: 'Valor base cobrado por entrega (R$)',
    isPublic: true,
  },
  {
    key: 'delivery_fee_per_km',
    value: '1.50',
    type: 'NUMBER',
    category: 'delivery',
    label: 'Taxa por Km',
    description: 'Valor adicional por quilometro (R$)',
    isPublic: true,
  },
  {
    key: 'delivery_min_fee',
    value: '5.00',
    type: 'NUMBER',
    category: 'delivery',
    label: 'Taxa Minima de Entrega',
    description: 'Valor minimo de taxa de entrega (R$)',
    isPublic: true,
  },
  {
    key: 'delivery_max_fee',
    value: '25.00',
    type: 'NUMBER',
    category: 'delivery',
    label: 'Taxa Maxima de Entrega',
    description: 'Valor maximo de taxa de entrega (R$)',
    isPublic: true,
  },
  {
    key: 'delivery_free_above',
    value: '100.00',
    type: 'NUMBER',
    category: 'delivery',
    label: 'Frete Gratis Acima de',
    description: 'Pedidos acima deste valor tem frete gratis (0 = desabilitado)',
    isPublic: true,
  },
  {
    key: 'delivery_max_radius_km',
    value: '15',
    type: 'NUMBER',
    category: 'delivery',
    label: 'Raio Maximo de Entrega (km)',
    description: 'Distancia maxima para entregas',
    isPublic: true,
  },

  // Platform Fees
  {
    key: 'platform_fee_percentage',
    value: '15',
    type: 'NUMBER',
    category: 'fees',
    label: 'Taxa da Plataforma (%)',
    description: 'Percentual cobrado dos restaurantes por pedido',
    isPublic: false,
  },
  {
    key: 'driver_commission_percentage',
    value: '80',
    type: 'NUMBER',
    category: 'fees',
    label: 'Comissao do Entregador (%)',
    description: 'Percentual da taxa de entrega que vai para o entregador',
    isPublic: false,
  },

  // Payment Gateway - Card Providers
  {
    key: 'card_gateway',
    value: 'both',
    type: 'STRING',
    category: 'payment',
    label: 'Gateway de Cartao',
    description: 'Gateway para pagamentos com cartao: stripe, mercadopago, both (ambos)',
    isPublic: true,
  },
  {
    key: 'stripe_enabled',
    value: 'true',
    type: 'BOOLEAN',
    category: 'payment',
    label: 'Stripe Habilitado',
    description: 'Habilita pagamentos via Stripe (1-click sem CVV)',
    isPublic: true,
  },
  {
    key: 'mercadopago_enabled',
    value: 'true',
    type: 'BOOLEAN',
    category: 'payment',
    label: 'Mercado Pago Habilitado',
    description: 'Habilita pagamentos via Mercado Pago',
    isPublic: true,
  },
  {
    key: 'stripe_public_key',
    value: '',
    type: 'STRING',
    category: 'payment',
    label: 'Stripe Public Key',
    description: 'Chave publica do Stripe',
    isPublic: true,
  },
  {
    key: 'stripe_secret_key',
    value: '',
    type: 'STRING',
    category: 'payment',
    label: 'Stripe Secret Key',
    description: 'Chave secreta do Stripe',
    isPublic: false,
  },
  {
    key: 'mercadopago_public_key',
    value: '',
    type: 'STRING',
    category: 'payment',
    label: 'Mercado Pago Public Key',
    description: 'Chave publica do Mercado Pago',
    isPublic: true,
  },
  {
    key: 'mercadopago_access_token',
    value: '',
    type: 'STRING',
    category: 'payment',
    label: 'Mercado Pago Access Token',
    description: 'Token de acesso do Mercado Pago',
    isPublic: false,
  },
  {
    key: 'pix_enabled',
    value: 'true',
    type: 'BOOLEAN',
    category: 'payment',
    label: 'PIX Habilitado',
    description: 'Permite pagamento via PIX',
    isPublic: true,
  },
  {
    key: 'cash_enabled',
    value: 'true',
    type: 'BOOLEAN',
    category: 'payment',
    label: 'Dinheiro Habilitado',
    description: 'Permite pagamento em dinheiro na entrega',
    isPublic: true,
  },
  {
    key: 'card_enabled',
    value: 'true',
    type: 'BOOLEAN',
    category: 'payment',
    label: 'Cartao Habilitado',
    description: 'Permite pagamento com cartao de credito/debito',
    isPublic: true,
  },

  // Order Settings
  {
    key: 'order_min_value',
    value: '15.00',
    type: 'NUMBER',
    category: 'orders',
    label: 'Valor Minimo do Pedido',
    description: 'Valor minimo para realizar um pedido (R$)',
    isPublic: true,
  },
  {
    key: 'order_auto_cancel_minutes',
    value: '30',
    type: 'NUMBER',
    category: 'orders',
    label: 'Cancelamento Automatico (min)',
    description: 'Tempo para cancelar pedido nao aceito pelo restaurante',
    isPublic: false,
  },
  {
    key: 'estimated_delivery_minutes',
    value: '45',
    type: 'NUMBER',
    category: 'orders',
    label: 'Tempo Estimado de Entrega (min)',
    description: 'Tempo padrao estimado para entrega',
    isPublic: true,
  },

  // App Settings
  {
    key: 'app_name',
    value: 'ZeFood',
    type: 'STRING',
    category: 'general',
    label: 'Nome do App',
    description: 'Nome exibido no aplicativo',
    isPublic: true,
  },
  {
    key: 'support_email',
    value: 'suporte@zefood.com',
    type: 'STRING',
    category: 'general',
    label: 'Email de Suporte',
    description: 'Email para contato de suporte',
    isPublic: true,
  },
  {
    key: 'support_phone',
    value: '',
    type: 'STRING',
    category: 'general',
    label: 'Telefone de Suporte',
    description: 'Telefone para contato de suporte',
    isPublic: true,
  },
  {
    key: 'maintenance_mode',
    value: 'false',
    type: 'BOOLEAN',
    category: 'general',
    label: 'Modo Manutencao',
    description: 'Coloca o app em modo de manutencao',
    isPublic: true,
  },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  private cache: Map<string, any> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultSettings();
    await this.loadCache();
  }

  private async seedDefaultSettings() {
    for (const setting of DEFAULT_SETTINGS) {
      await this.prisma.setting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting as any,
      });
    }
  }

  private async loadCache() {
    const settings = await this.prisma.setting.findMany();
    for (const setting of settings) {
      this.cache.set(setting.key, this.parseValue(setting.value, setting.type));
    }
  }

  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'NUMBER':
        return parseFloat(value);
      case 'BOOLEAN':
        return value === 'true';
      case 'JSON':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  private stringifyValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  // Get a single setting value
  async get<T = any>(key: string): Promise<T | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) return null;

    const value = this.parseValue(setting.value, setting.type);
    this.cache.set(key, value);
    return value as T;
  }

  // Get multiple settings by category
  async getByCategory(category: string) {
    const settings = await this.prisma.setting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      ...s,
      parsedValue: this.parseValue(s.value, s.type),
    }));
  }

  // Get all settings
  async getAll() {
    const settings = await this.prisma.setting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return settings.map((s) => ({
      ...s,
      parsedValue: this.parseValue(s.value, s.type),
    }));
  }

  // Get public settings only
  async getPublicSettings() {
    const settings = await this.prisma.setting.findMany({
      where: { isPublic: true },
      orderBy: { key: 'asc' },
    });

    const result: Record<string, any> = {};
    for (const setting of settings) {
      result[setting.key] = this.parseValue(setting.value, setting.type);
    }
    return result;
  }

  // Update a single setting
  async update(key: string, value: any) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new Error(`Setting ${key} not found`);
    }

    const stringValue = this.stringifyValue(value);

    const updated = await this.prisma.setting.update({
      where: { key },
      data: { value: stringValue },
    });

    // Update cache
    this.cache.set(key, this.parseValue(stringValue, setting.type));

    return {
      ...updated,
      parsedValue: this.parseValue(updated.value, updated.type),
    };
  }

  // Update multiple settings at once
  async updateMany(settings: Record<string, any>) {
    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      try {
        const result = await this.update(key, value);
        results.push(result);
      } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
      }
    }

    return results;
  }

  // Calculate delivery fee based on distance
  async calculateDeliveryFee(distanceKm: number, orderTotal: number): Promise<number> {
    const baseFee = (await this.get<number>('delivery_base_fee')) || 5;
    const feePerKm = (await this.get<number>('delivery_fee_per_km')) || 1.5;
    const minFee = (await this.get<number>('delivery_min_fee')) || 5;
    const maxFee = (await this.get<number>('delivery_max_fee')) || 25;
    const freeAbove = (await this.get<number>('delivery_free_above')) || 0;

    // Free delivery for orders above threshold
    if (freeAbove > 0 && orderTotal >= freeAbove) {
      return 0;
    }

    let fee = baseFee + distanceKm * feePerKm;
    fee = Math.max(fee, minFee);
    fee = Math.min(fee, maxFee);

    return Math.round(fee * 100) / 100;
  }

  // Get all categories
  async getCategories() {
    const settings = await this.prisma.setting.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    const categoryLabels: Record<string, string> = {
      delivery: 'Entrega',
      fees: 'Taxas',
      payment: 'Pagamento',
      orders: 'Pedidos',
      general: 'Geral',
    };

    return settings.map((s) => ({
      key: s.category,
      label: categoryLabels[s.category] || s.category,
    }));
  }
}
