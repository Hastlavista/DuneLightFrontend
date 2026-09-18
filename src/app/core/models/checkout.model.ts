import { PaymentDto, PaymentMethod, PaymentStatus } from './appointment.model';

/** Commercial subject of one CheckoutItem row - exactly one of
 * bookingId/packageId/productId is populated to match. Product is the only
 * type whose quantity can exceed 1 (Booking/Package are always quantity 1) -
 * see CheckoutItemDto. */
export type CheckoutItemType = 'Booking' | 'Package' | 'Product';

const CHECKOUT_ITEM_TYPE_TRANSLATION_KEYS: Record<CheckoutItemType, string> = {
  Booking: 'CHECKOUT.ITEM_TYPE.BOOKING',
  Package: 'CHECKOUT.ITEM_TYPE.PACKAGE',
  Product: 'CHECKOUT.ITEM_TYPE.PRODUCT',
};

export function checkoutItemTypeTranslationKey(type: CheckoutItemType): string {
  return CHECKOUT_ITEM_TYPE_TRANSLATION_KEYS[type];
}

const CHECKOUT_ITEM_TYPE_ICONS: Record<CheckoutItemType, string> = {
  Booking: 'pi-calendar',
  Package: 'pi-ticket',
  Product: 'pi-box',
};

export function checkoutItemTypeIcon(type: CheckoutItemType): string {
  return CHECKOUT_ITEM_TYPE_ICONS[type];
}

/** Minimal lifecycle of one Checkout/cart. `Open` is the only non-terminal
 * state. `Voided` is a narrow internal correction path (check-in reversal),
 * never reachable through a normal staff action - render it read-only, do
 * not build a "void" affordance for it (see spec section 28). */
export type CheckoutStatus = 'Open' | 'Completed' | 'Cancelled' | 'Voided';

const CHECKOUT_STATUS_TRANSLATION_KEYS: Record<CheckoutStatus, string> = {
  Open: 'CHECKOUT.STATUS.OPEN',
  Completed: 'CHECKOUT.STATUS.COMPLETED',
  Cancelled: 'CHECKOUT.STATUS.CANCELLED',
  Voided: 'CHECKOUT.STATUS.VOIDED',
};

export function checkoutStatusTranslationKey(status: CheckoutStatus): string {
  return CHECKOUT_STATUS_TRANSLATION_KEYS[status];
}

const CHECKOUT_STATUS_SEVERITIES: Record<CheckoutStatus, 'info' | 'success' | 'danger' | 'warn' | 'secondary'> = {
  Open: 'info',
  Completed: 'success',
  Cancelled: 'danger',
  Voided: 'secondary',
};

export function checkoutStatusSeverity(status: CheckoutStatus): 'info' | 'success' | 'danger' | 'warn' | 'secondary' {
  return CHECKOUT_STATUS_SEVERITIES[status];
}

const PAYMENT_STATUS_SEVERITIES: Record<PaymentStatus, 'success' | 'secondary'> = {
  Completed: 'success',
  Voided: 'secondary',
};

export function paymentStatusSeverity(status: PaymentStatus): 'success' | 'secondary' {
  return PAYMENT_STATUS_SEVERITIES[status];
}

const PAYMENT_STATUS_TRANSLATION_KEYS: Record<PaymentStatus, string> = {
  Completed: 'CHECKOUT.PAYMENT_STATUS.COMPLETED',
  Voided: 'CHECKOUT.PAYMENT_STATUS.VOIDED',
};

export function paymentStatusTranslationKey(status: PaymentStatus): string {
  return PAYMENT_STATUS_TRANSLATION_KEYS[status];
}

/** Derived financial summary of one CheckoutItem row - server-calculated,
 * never recomputed client-side (see CheckoutFinancialsCalculator).
 * `retailAmount` is the full retail value regardless of settlement method;
 * `monetaryDue` is what's actually owed in money - 0 for a package-covered
 * Booking even though `retailAmount` is still its full retail price (spec
 * sections 5/33). */
export interface CheckoutItemDto {
  id: string;
  type: CheckoutItemType;
  description: string;
  unitPrice: number;
  quantity: number;
  retailAmount: number;
  monetaryDue: number;
  paidAmount: number;
  outstandingAmount: number;
  bookingId?: string;
  packageId?: string;
  productId?: string;
  /** Populated only once Complete has issued the ClientPackage for this Package item. */
  clientPackageId?: string;
  createdAt: string;
  createdBy?: string;
}

/** Server-calculated totals of the whole Checkout - see CheckoutFinancialsCalculator.
 * Always the source of truth for "how much is left to pay" - never sum
 * CheckoutItemDto rows client-side to derive these. */
export interface CheckoutTotalsDto {
  retailTotal: number;
  monetaryDue: number;
  paidAmount: number;
  outstandingAmount: number;
  isFullyPaid: boolean;
}

/** GET /api/checkouts/{id} and every mutating action's response - always
 * re-render from the response body of a mutation instead of hand-patching
 * local state (see spec section 45). */
export interface CheckoutDto {
  id: string;
  status: CheckoutStatus;
  companyId: string;
  companyName: string;
  clientId: string;
  clientName: string;
  items: CheckoutItemDto[];
  /** Newest first, as returned by the backend. */
  payments: PaymentDto[];
  totals: CheckoutTotalsDto;
  createdAt: string;
  createdBy?: string;
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

/** Body for POST /api/checkouts - opening an empty Checkout is allowed, items
 * are added afterwards. */
export interface CheckoutCreateRequest {
  clientId: string;
  companyId: string;
}

/** Body for POST /api/checkouts/{id}/items/booking - server snapshots the
 * price/description, no amount is sent. */
export interface CheckoutAddBookingItemRequest {
  bookingId: string;
}

/** Body for POST /api/checkouts/{id}/items/package - price is resolved
 * server-side via the price list at add time, no amount is sent. */
export interface CheckoutAddPackageItemRequest {
  packageId: string;
}

/** Body for POST /api/checkouts/{id}/items/product - server resolves
 * unitPrice from Product.defaultPrice and snapshots it; re-adding the same
 * product merges into the existing line's quantity instead of duplicating it
 * (see spec section 47). */
export interface CheckoutAddProductItemRequest {
  productId: string;
  quantity: number;
}

/** One explicit manual allocation of part of a Payment to a specific
 * CheckoutItem - only used when CheckoutPaymentCreateRequest.allocations is
 * supplied; the MVP UI always omits allocations in favor of automatic FIFO
 * (see spec section 20 / CheckoutsService.recordPayment's doc). Kept here to
 * match the backend contract 1:1 for any future explicit-allocation UI. */
export interface CheckoutPaymentAllocationRequest {
  checkoutItemId: string;
  amount: number;
}

/** Body for POST /api/checkouts/{id}/payments - omitting `allocations`
 * (the MVP default) makes the server allocate FIFO by item creation order
 * across every item with outstanding balance. */
export interface CheckoutPaymentCreateRequest {
  amount: number;
  method: PaymentMethod;
  note?: string;
  allocations?: CheckoutPaymentAllocationRequest[];
}

/** Body for POST /api/checkouts/{id}/payments/{paymentId}/void - `reason` is
 * required at runtime (PAYMENT_VOID_REASON_REQUIRED), not by a DTO attribute. */
export interface CheckoutPaymentVoidRequest {
  reason: string;
}
