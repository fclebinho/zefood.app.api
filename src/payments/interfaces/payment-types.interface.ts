import { PaymentMethod, PaymentStatus, Order, Customer, User, Restaurant } from '@prisma/client';

/**
 * Configuration for a payment gateway
 */
export interface GatewayConfig {
  secretKey?: string;
  publicKey?: string;
  accessToken?: string;
  webhookSecret?: string;
  sandbox?: boolean;
  [key: string]: any;
}

/**
 * Card data input for new card payments
 */
export interface CardDataInput {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  identificationType?: string;
  identificationNumber?: string;
}

/**
 * User data for customer creation
 */
export interface UserData {
  id: string;
  email: string;
  name: string;
  phone?: string;
  document?: string;
  documentType?: string;
}

/**
 * Payment data input
 */
export interface PaymentData {
  method: PaymentMethod;
  cardToken?: string;
  cardData?: CardDataInput;
  savedCardId?: string;
  securityCode?: string;
  installments?: number;
}

/**
 * Order with relations for payment processing
 */
export interface OrderWithRelations extends Order {
  restaurant: Restaurant;
  customer: Customer & { user?: User };
  items?: any[];
}

/**
 * Result of a payment operation
 */
export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  status: PaymentStatus;
  gatewayStatus?: string;
  redirectUrl?: string;
  pixQrCode?: string;
  pixCode?: string;
  pixExpiresAt?: Date;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/**
 * Result of webhook processing
 */
export interface WebhookResult {
  success: boolean;
  orderId?: string;
  paymentId?: string;
  status?: PaymentStatus;
  action?: 'payment.updated' | 'payment.created' | 'payment.refunded' | 'unknown';
  error?: string;
}

/**
 * Saved card representation
 */
export interface SavedCard {
  id: string;
  provider: string;
  gatewayCardId: string;
  gatewayCustomerId: string;
  lastFourDigits: string;
  expirationMonth: number;
  expirationYear: number;
  cardholderName: string;
  brand: string;
  isDefault: boolean;
}

/**
 * Payment features that a gateway may support
 */
export type PaymentFeature =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'saved_cards'
  | 'one_click'
  | 'recurring'
  | 'refund'
  | 'partial_refund'
  | 'installments'
  | 'boleto';

/**
 * Refund request data
 */
export interface RefundRequest {
  paymentId: string;
  amount?: number; // If not provided, full refund
  reason?: string;
}

/**
 * Refund result
 */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
  error?: string;
}
