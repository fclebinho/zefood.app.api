import {
  GatewayConfig,
  PaymentData,
  PaymentResult,
  WebhookResult,
  PaymentFeature,
  RefundRequest,
  RefundResult,
  OrderWithRelations,
} from './payment-types.interface';
import { PaymentStatus } from '@prisma/client';

/**
 * Base interface for all payment gateways
 *
 * Implement this interface to add a new payment provider to the system.
 * Each gateway is responsible for its own initialization, payment processing,
 * and webhook handling.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class PagSeguroGateway implements PaymentGateway {
 *   readonly name = 'pagseguro';
 *   readonly displayName = 'PagSeguro';
 *   // ... implement all methods
 * }
 * ```
 */
export interface PaymentGateway {
  /**
   * Unique identifier for this gateway (lowercase, no spaces)
   * @example 'stripe', 'mercadopago', 'pagseguro'
   */
  readonly name: string;

  /**
   * Human-readable display name
   * @example 'Stripe', 'Mercado Pago', 'PagSeguro'
   */
  readonly displayName: string;

  // ============================================
  // Lifecycle Methods
  // ============================================

  /**
   * Initialize the gateway with configuration
   * Called during module initialization
   */
  initialize(config?: GatewayConfig): Promise<void>;

  /**
   * Check if the gateway has valid credentials configured
   */
  isConfigured(): boolean;

  /**
   * Check if the gateway is enabled in settings
   * (may be configured but disabled by admin)
   */
  isEnabled(): Promise<boolean>;

  // ============================================
  // Payment Processing
  // ============================================

  /**
   * Create and process a payment
   * @param order - Order with relations (restaurant, customer, items)
   * @param amount - Amount in BRL (as number, e.g., 49.90)
   * @param data - Payment data (method, card info, etc.)
   * @returns Payment result with status, IDs, and any required redirect/QR info
   */
  createPayment(
    order: OrderWithRelations,
    amount: number,
    data: PaymentData,
  ): Promise<PaymentResult>;

  /**
   * Process incoming webhook from the payment provider
   * @param payload - Raw webhook payload (parsed JSON)
   * @param headers - HTTP headers (for signature verification)
   * @returns Webhook processing result
   */
  processWebhook(payload: any, headers?: Record<string, string>): Promise<WebhookResult>;

  // ============================================
  // Status Mapping
  // ============================================

  /**
   * Map gateway-specific status to our unified PaymentStatus enum
   * @param gatewayStatus - Status string from the gateway
   * @returns Unified PaymentStatus
   */
  mapStatus(gatewayStatus: string): PaymentStatus;

  /**
   * Translate gateway error codes/messages to user-friendly Portuguese messages
   * @param error - Error object or string from the gateway
   * @returns User-friendly error message in Portuguese
   */
  translateError(error: any): string;

  // ============================================
  // Feature Support
  // ============================================

  /**
   * Check if this gateway supports a specific feature
   * @param feature - Feature to check
   * @returns true if feature is supported
   */
  supportsFeature(feature: PaymentFeature): boolean;

  /**
   * Get list of all supported features
   */
  getSupportedFeatures(): PaymentFeature[];

  // ============================================
  // Refunds (optional - check supportsFeature first)
  // ============================================

  /**
   * Process a refund for a payment
   * @param request - Refund request with payment ID and optional amount
   * @returns Refund result
   */
  refund?(request: RefundRequest): Promise<RefundResult>;
}

/**
 * Symbol for gateway injection token
 */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
