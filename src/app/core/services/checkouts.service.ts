import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CheckoutAddBookingItemRequest,
  CheckoutAddPackageItemRequest,
  CheckoutAddProductItemRequest,
  CheckoutCreateRequest,
  CheckoutDto,
  CheckoutPaymentCreateRequest,
  CheckoutPaymentVoidRequest,
} from '../models/checkout.model';

/** Checkout/POS - not a PagedCrudService subclass: the backend has no
 * global/paged Checkout list (only a per-client history, see getByClient's
 * doc) and every action is a dedicated route rather than a generic PUT (same
 * shape as AppointmentsService). Every mutating call below returns the full,
 * fresh CheckoutDto - always re-render from that response instead of
 * hand-patching local state (spec section 45). */
@Injectable({ providedIn: 'root' })
export class CheckoutsService {
  private readonly resourceUrl = `${environment.apiUrl}/api/checkouts`;

  constructor(private readonly http: HttpClient) {}

  /** GET /api/checkouts?clientId= - this client's Checkout history, newest
   * first, unpaged. The ONLY lookup the backend offers for "find/open an
   * active Checkout" - there is no global/company-scoped browse endpoint
   * (documented backend gap, see the Phase 2 implementation report). */
  getByClient(clientId: string): Observable<CheckoutDto[]> {
    const params = new HttpParams().set('clientId', clientId);
    return this.http.get<CheckoutDto[]>(this.resourceUrl, { params });
  }

  getById(id: string): Observable<CheckoutDto> {
    return this.http.get<CheckoutDto>(`${this.resourceUrl}/${id}`);
  }

  /** POST /api/checkouts - opening an empty Checkout (no items yet) is allowed. */
  create(request: CheckoutCreateRequest): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(this.resourceUrl, request);
  }

  addBookingItem(checkoutId: string, request: CheckoutAddBookingItemRequest): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/items/booking`, request);
  }

  addPackageItem(checkoutId: string, request: CheckoutAddPackageItemRequest): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/items/package`, request);
  }

  addProductItem(checkoutId: string, request: CheckoutAddProductItemRequest): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/items/product`, request);
  }

  /** DELETE /api/checkouts/{id}/items/{itemId} - blocked server-side
   * (CHECKOUT_ITEM_HAS_ALLOCATIONS) while the item has a Completed payment
   * allocation; void the payment first. */
  removeItem(checkoutId: string, itemId: string): Observable<CheckoutDto> {
    return this.http.delete<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/items/${itemId}`);
  }

  /** POST /api/checkouts/{id}/payments - omit `allocations` on the request for
   * automatic FIFO allocation across items with an outstanding balance (the
   * MVP UI's only mode, see spec section 20). */
  recordPayment(checkoutId: string, request: CheckoutPaymentCreateRequest): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/payments`, request);
  }

  /** POST /api/checkouts/{id}/payments/{paymentId}/void - only permitted while
   * the Checkout is Open. */
  voidPayment(checkoutId: string, paymentId: string, request: CheckoutPaymentVoidRequest): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/payments/${paymentId}/void`, request);
  }

  /** POST /api/checkouts/{id}/complete - requires totals.isFullyPaid; on
   * INSUFFICIENT_STOCK the whole transaction rolls back and the Checkout stays
   * Open (spec section 26). */
  complete(checkoutId: string): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/complete`, null);
  }

  /** POST /api/checkouts/{id}/cancel - blocked server-side
   * (CHECKOUT_HAS_ACTIVE_PAYMENTS) while any Completed payment exists; void
   * them first. No request body, no cancellation-reason field. */
  cancel(checkoutId: string): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.resourceUrl}/${checkoutId}/cancel`, null);
  }
}
