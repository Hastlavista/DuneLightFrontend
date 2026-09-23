import { Component, ViewChild, inject, output, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { ProductDto } from '../../../../../core/models/product.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ProductsService } from '../../../../../core/services/products.service';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { EurCurrencyPipe } from '../../../../../shared/pipes/eur-currency.pipe';
import { ProductFormDialogComponent } from './product-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Product catalog CRUD (grants products.view / products.manage). Delete is
 * only offered when the backend allows it - ProductService.Delete throws
 * REFERENCED_CANNOT_DELETE once a Product has any stock/movement/checkout
 * history, so the confirm-delete flow below just surfaces that error like
 * any other business-rule error rather than trying to predict it client-side.
 * Inactive products stay listed (via "show inactive") since they remain
 * reachable for stock reconciliation on the Zaliha tab - see StockPageComponent.
 */
@Component({
  selector: 'app-admin-catalog-products',
  imports: [TableModule, Button, TranslatePipe, EurCurrencyPipe, ListToolbarComponent, StatusTagComponent, ProductFormDialogComponent],
  templateUrl: './products-list.component.html',
  styleUrl: './products-list.component.scss',
})
export class ProductsListComponent {
  private readonly productsService = inject(ProductsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<ProductDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly failed = signal(false);
  // Latest-request-wins guard for page/search/filter changes.
  private fetchToken = 0;
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly dialogVisible = signal(false);
  readonly editingProduct = signal<ProductDto | null>(null);
  /** Lets the sibling stock view invalidate its product/stock join after a
   * catalog mutation, even when its tab was already instantiated. */
  readonly changed = output<void>();

  constructor() {
    if (this.route.snapshot.queryParamMap.get('create') === 'product') {
      this.openCreate();
    }
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.rows.set(rows);
    this.fetch(first, rows);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  openCreate(): void {
    this.editingProduct.set(null);
    this.dialogVisible.set(true);
  }

  onDialogVisibleChange(visible: boolean): void {
    this.dialogVisible.set(visible);
    if (!visible && this.route.snapshot.queryParamMap.get('create') === 'product') {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { create: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  openEdit(product: ProductDto): void {
    this.editingProduct.set(product);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
    this.changed.emit();
  }

  activate(product: ProductDto): void {
    this.productsService.activate(product.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.PRODUCTS.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
        this.changed.emit();
      },
      error: () => {},
    });
  }

  confirmDeactivate(product: ProductDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.PRODUCTS.CONFIRM_DEACTIVATE', { name: product.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.productsService.deactivate(product.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.PRODUCTS.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
            this.changed.emit();
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(product: ProductDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.PRODUCTS.CONFIRM_DELETE', { name: product.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.productsService.delete(product.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.PRODUCTS.DELETED'));
            this.fetch(this.table?.first ?? 0, this.rows());
            this.changed.emit();
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(first: number, rows: number): void {
    const token = ++this.fetchToken;
    this.loading.set(true);
    this.failed.set(false);
    const page = Math.floor(first / rows) + 1;
    this.productsService
      .getPage({
        page,
        pageSize: rows,
        search: this.search() || undefined,
        isActive: this.showInactive() ? undefined : true,
      })
      .pipe(
        finalize(() => {
          if (token === this.fetchToken) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (result) => {
          if (token !== this.fetchToken) {
            return;
          }
          // The last row of the last page was deleted/deactivated: show the
          // last page that still has rows instead of an empty page.
          const lastFirst = result.totalCount > 0 ? Math.floor((result.totalCount - 1) / rows) * rows : 0;
          if (result.items.length === 0 && lastFirst < first) {
            if (this.table) {
              this.table.first = lastFirst;
            }
            this.fetch(lastFirst, rows);
            return;
          }
          this.items.set(result.items);
          this.totalCount.set(result.totalCount);
        },
        // Never show a failed load as "no results", nor keep the previous filter's rows.
        error: () => {
          if (token !== this.fetchToken) {
            return;
          }
          this.items.set([]);
          this.totalCount.set(0);
          this.failed.set(true);
        },
      });
  }
}
