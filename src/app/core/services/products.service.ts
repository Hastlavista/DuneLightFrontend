import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ProductDto, ProductUpsertRequest } from '../models/product.model';
import { PagedCrudService } from './paged-crud.service';

/** Product catalog CRUD (grants products.view / products.manage). Also backs
 * the Checkout "add product" picker's read-only getPage() use - see
 * AddCheckoutItemDialogComponent. */
@Injectable({ providedIn: 'root' })
export class ProductsService extends PagedCrudService<ProductDto, ProductUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/products`;

  constructor(http: HttpClient) {
    super(http);
  }
}
