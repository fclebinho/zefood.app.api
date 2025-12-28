import { UserData, SavedCard, PaymentResult, OrderWithRelations } from './payment-types.interface';

/**
 * Interface for gateways that support saved card management
 *
 * Implement this interface alongside PaymentGateway to enable
 * card saving functionality for your payment provider.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class StripeGateway implements PaymentGateway, CardManager {
 *   // ... implement both interfaces
 * }
 * ```
 */
export interface CardManager {
  // ============================================
  // Customer Management
  // ============================================

  /**
   * Get or create a customer in the payment gateway
   * @param userId - Internal user ID
   * @param userData - User information for customer creation
   * @returns Gateway's customer ID
   */
  getOrCreateCustomer(userId: string, userData: UserData): Promise<string>;

  /**
   * Get the gateway's customer ID for a user
   * @param userId - Internal user ID
   * @returns Gateway's customer ID or null if not found
   */
  getCustomerId(userId: string): Promise<string | null>;

  // ============================================
  // Card Management
  // ============================================

  /**
   * Save a new card for a customer
   * @param customerId - Gateway's customer ID
   * @param cardToken - Tokenized card from frontend
   * @param setAsDefault - Whether to set as default card
   * @returns Saved card information
   */
  saveCard(customerId: string, cardToken: string, setAsDefault?: boolean): Promise<SavedCard>;

  /**
   * Delete a saved card
   * @param customerId - Gateway's customer ID
   * @param cardId - Gateway's card ID
   */
  deleteCard(customerId: string, cardId: string): Promise<void>;

  /**
   * List all saved cards for a customer
   * @param customerId - Gateway's customer ID
   * @returns List of saved cards
   */
  listCards(customerId: string): Promise<SavedCard[]>;

  /**
   * Set a card as the default payment method
   * @param customerId - Gateway's customer ID
   * @param cardId - Gateway's card ID
   */
  setDefaultCard(customerId: string, cardId: string): Promise<void>;

  // ============================================
  // Saved Card Payments
  // ============================================

  /**
   * Charge a saved card
   * @param savedCard - Saved card information from database
   * @param amount - Amount to charge
   * @param order - Order with relations
   * @param securityCode - CVV if required (some gateways require it)
   * @returns Payment result
   */
  chargeWithSavedCard(
    savedCard: SavedCard,
    amount: number,
    order: OrderWithRelations,
    securityCode?: string,
  ): Promise<PaymentResult>;

  /**
   * Check if this gateway requires CVV for saved card payments
   * @returns true if CVV is required
   */
  requiresCvvForSavedCard(): boolean;
}

/**
 * Symbol for card manager injection token
 */
export const CARD_MANAGER = Symbol('CARD_MANAGER');
