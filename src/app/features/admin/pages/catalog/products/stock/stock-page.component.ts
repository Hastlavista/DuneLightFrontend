import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Button } from 'primeng/button';
import { finalize, forkJoin } from 'rxjs';
import { ProductDto, ProductStockDto, StockTransferResultDto } from '../../../../../../core/models/product.model';
import { CompanyContextService } from '../../../../../../core/services/company-context.service';
import { CurrentEmployeeService } from '../../../../../../core/services/current-employee.service';
import { ProductsService } from '../../../../../../core/services/products.service';
import { StockService } from '../../../../../../core/services/stock.service';
import { ListToolbarComponent } from '../../../../../../shared/components/list-toolbar/list-toolbar.component';
import { HrDatePipe } from '../../../../../../shared/pipes/hr-date.pipe';
import { StockAdjustDialogComponent, StockAdjustTarget } from './stock-adjust-dialog.component';
import { StockMovementsDialogComponent } from './stock-movements-dialog.component';
import { StockTransferDialogComponent, StockTransferSource } from './stock-transfer-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Company-scoped stock view (grants stock.view / stock.manage). Starts from
 * the active Product catalog (paged, same fetch as ProductsListComponent) and
 * LEFT-JOINs it client-side, for display only, with GET
 * /api/stock/company/{companyId} (which only returns rows that already exist -
 * spec section 12): a Product with no matching row shows quantity 0, never a
 * blank/error state, and viewing this page never creates a ProductStock row
 * itself (spec section 10/12/47). The stock map is fetched once per Company
 * selection (not once per Product row) to avoid N+1 calls.
 */
@Component({
  selector: 'app-admin-stock',
  imports: [
    FormsModule,
    Select,
    Paginator,
    Button,
    TranslatePipe,
    HrDatePipe,
    ListToolbarComponent,
    StockAdjustDialogComponent,
    StockTransferDialogComponent,
    StockMovementsDialogComponent,
  ],
  templateUrl: './stock-page.component.html',
  styleUrl: './stock-page.component.scss',
})
export class StockPageComponent {
  private readonly productsService = inject(ProductsService);
  private readonly stockService = inject(StockService);
  protected readonly companyContextService = inject(CompanyContextService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);

  readonly selectedCompanyId = signal<string | null>(null);

  readonly items = signal<ProductDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly failed = signal(false);

  // Latest-request-wins guard for company/page/search changes.
  private requestToken = 0;
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly first = signal(0);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly stockByProductId = signal<Record<string, ProductStockDto>>({});

  readonly adjustDialogVisible = signal(false);
  readonly adjustTarget = signal<StockAdjustTarget | null>(null);

  readonly transferDialogVisible = signal(false);
  readonly transferSource = signal<StockTransferSource | null>(null);

  readonly movementsDialogVisible = signal(false);
  readonly movementsProductId = signal<string | null>(null);
  readonly movementsProductName = signal('');

  constructor() {
    if (this.companyContextService.companies().length === 0) {
      this.companyContextService.loadCompanies();
    }

    effect(() => {
      const companies = this.companyContextService.companies();
      if (this.selectedCompanyId() || companies.length === 0) {
        return;
      }
      const preferred = this.companyContextService.selectedCompanyId();
      this.selectedCompanyId.set(preferred && companies.some((c) => c.id === preferred) ? preferred : companies[0].id);
    });

    // The shell selector is shared state.  Refresh the Company-scoped stock
    // map when it changes instead of leaving quantities from the old Company.
    effect(() => {
      const companyId = this.companyContextService.selectedCompanyId();
      if (companyId && companyId !== this.selectedCompanyId()) {
        this.selectedCompanyId.set(companyId);
      }
    });

    effect(() => {
      const companyId = this.selectedCompanyId();
      if (companyId) {
        untracked(() => {
          this.first.set(0);
          this.fetch(0, this.rows());
        });
      }
    });
  }

  onCompanyChange(companyId: string | null): void {
    this.selectedCompanyId.set(companyId);
    this.companyContextService.selectCompany(companyId);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.resetAndFetch();
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.resetAndFetch();
  }

  onPageChange(event: PaginatorState): void {
    const rows = event.rows ?? this.rows();
    const first = event.first ?? 0;
    this.rows.set(rows);
    this.first.set(first);
    this.fetchProducts(first, rows);
  }

  /** Re-read the server-authoritative product/stock join after catalog CRUD.
   * Without this, an already-instantiated stock tab can retain an empty
   * product list until a browser refresh. */
  refresh(): void {
    this.fetch(this.first(), this.rows());
  }

  quantityFor(productId: string): number {
    return this.stockByProductId()[productId]?.quantity ?? 0;
  }

  hasStockRow(productId: string): boolean {
    return productId in this.stockByProductId();
  }

  updatedAtFor(productId: string): string | null {
    return this.stockByProductId()[productId]?.updatedAt ?? null;
  }

  openAdjust(product: ProductDto): void {
    const companyId = this.selectedCompanyId();
    const company = this.companyContextService.companies().find((c) => c.id === companyId);
    if (!companyId || !company) {
      return;
    }
    this.adjustTarget.set({
      productId: product.id,
      productName: product.name,
      companyId,
      companyName: company.name,
      currentQuantity: this.quantityFor(product.id),
    });
    this.adjustDialogVisible.set(true);
  }

  onAdjusted(result: ProductStockDto): void {
    this.stockByProductId.update((map) => ({ ...map, [result.productId]: result }));
  }

  openTransfer(product: ProductDto): void {
    const companyId = this.selectedCompanyId();
    const company = this.companyContextService.companies().find((c) => c.id === companyId);
    if (!companyId || !company) {
      return;
    }
    this.transferSource.set({
      productId: product.id,
      productName: product.name,
      companyId,
      companyName: company.name,
      currentQuantity: this.quantityFor(product.id),
    });
    this.transferDialogVisible.set(true);
  }

  onTransferred(result: StockTransferResultDto): void {
    this.stockByProductId.update((map) => {
      const next = { ...map, [result.source.productId]: result.source };
      if (result.destination.companyId === this.selectedCompanyId()) {
        next[result.destination.productId] = result.destination;
      }
      return next;
    });
  }

  onTransferSourceQuantityChanged(quantity: number): void {
    const source = this.transferSource();
    if (!source) {
      return;
    }
    this.stockByProductId.update((map) => {
      const existing = map[source.productId];
      return existing ? { ...map, [source.productId]: { ...existing, quantity } } : map;
    });
  }

  openMovements(product: ProductDto): void {
    this.movementsProductId.set(product.id);
    this.movementsProductName.set(product.name);
    this.movementsDialogVisible.set(true);
  }

  private resetAndFetch(): void {
    this.first.set(0);
    this.fetch(0, this.rows());
  }

  private fetch(first: number, rows: number): void {
    const companyId = this.selectedCompanyId();
    if (!companyId) {
      return;
    }
    const token = ++this.requestToken;
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      products: this.fetchProductsPage(first, rows),
      stock: this.stockService.getByCompany(companyId, { suppressErrorToast: true }),
    })
      .pipe(finalize(() => this.settle(token)))
      .subscribe({
        next: ({ products, stock }) => {
          if (token !== this.requestToken) {
            return;
          }
          this.items.set(products.items);
          this.totalCount.set(products.totalCount);
          this.stockByProductId.set(
            stock.reduce<Record<string, ProductStockDto>>((acc, row) => {
              acc[row.productId] = row;
              return acc;
            }, {}),
          );
        },
        error: () => this.fail(token),
      });
  }

  /** Products-only refetch (pagination) - the Company-scoped stock map stays
   * valid since it doesn't change with the product page/search/filter. */
  private fetchProducts(first: number, rows: number): void {
    const token = ++this.requestToken;
    this.loading.set(true);
    this.failed.set(false);
    this.fetchProductsPage(first, rows)
      .pipe(finalize(() => this.settle(token)))
      .subscribe({
        next: (result) => {
          if (token !== this.requestToken) {
            return;
          }
          this.items.set(result.items);
          this.totalCount.set(result.totalCount);
        },
        error: () => this.fail(token),
      });
  }

  private settle(token: number): void {
    if (token === this.requestToken) {
      this.loading.set(false);
    }
  }

  // Both requests suppress the interceptor toast, so the page itself must
  // show the failure instead of an empty or stale list.
  private fail(token: number): void {
    if (token !== this.requestToken) {
      return;
    }
    this.items.set([]);
    this.totalCount.set(0);
    this.stockByProductId.set({});
    this.failed.set(true);
  }

  private fetchProductsPage(first: number, rows: number) {
    const page = Math.floor(first / rows) + 1;
    return this.productsService.getPage(
      {
        page,
        pageSize: rows,
        search: this.search() || undefined,
        isActive: this.showInactive() ? undefined : true,
      },
      { suppressErrorToast: true },
    );
  }
}
