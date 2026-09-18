import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import {
  ProductStockDto,
  StockAdjustRequest,
  StockMovementDto,
  StockTransferRequest,
  StockTransferResultDto,
} from '../models/product.model';

/** Stock lookup/mutation (grants stock.view / stock.manage). getByCompany()
 * also backs the Checkout "add product" picker's non-reserving "current
 * stock: N" hint - see AddCheckoutItemDialogComponent; adding a product to a
 * Checkout never reserves stock, the real check only happens on Complete via
 * INSUFFICIENT_STOCK. */
@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly resourceUrl = `${environment.apiUrl}/api/stock`;

  constructor(private readonly http: HttpClient) {}

  getByCompany(companyId: string, options?: { suppressErrorToast?: boolean }): Observable<ProductStockDto[]> {
    return this.http.get<ProductStockDto[]>(`${this.resourceUrl}/company/${companyId}`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  getByProduct(productId: string, options?: { suppressErrorToast?: boolean }): Observable<ProductStockDto[]> {
    return this.http.get<ProductStockDto[]>(`${this.resourceUrl}/product/${productId}`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  getMovements(productId: string, options?: { suppressErrorToast?: boolean }): Observable<StockMovementDto[]> {
    return this.http.get<StockMovementDto[]>(`${this.resourceUrl}/product/${productId}/movements`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  /** Sets stock to an ABSOLUTE quantity - see StockAdjustRequest doc. Reason
   * is mandatory; `suppressErrorToast` lets the dialog show
   * STOCK_ADJUSTMENT_REASON_REQUIRED inline instead of a toast. */
  adjust(
    productId: string,
    companyId: string,
    request: StockAdjustRequest,
    options?: { suppressErrorToast?: boolean },
  ): Observable<ProductStockDto> {
    return this.http.post<ProductStockDto>(
      `${this.resourceUrl}/product/${productId}/company/${companyId}/adjust`,
      request,
      { context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false) },
    );
  }

  /** One atomic transfer between two Companies - never implement as two
   * separate adjust() calls from the frontend, see StockTransferRequest doc.
   * `suppressErrorToast` lets the dialog show INSUFFICIENT_STOCK inline. */
  transfer(
    request: StockTransferRequest,
    options?: { suppressErrorToast?: boolean },
  ): Observable<StockTransferResultDto> {
    return this.http.post<StockTransferResultDto>(`${this.resourceUrl}/transfers`, request, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }
}
