import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import {
  executionModeTranslationKey,
  ServiceCategoryDto,
} from '../../../../../core/models/service-category.model';
import { ServiceDto } from '../../../../../core/models/service.model';
import { ServiceCategoriesService } from '../../../../../core/services/service-categories.service';
import { ServicesService } from '../../../../../core/services/services.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { EurCurrencyPipe } from '../../../../../shared/pipes/eur-currency.pipe';
import { ServiceFormDialogComponent } from './service-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;
/** pageSize max is 200 - used to fetch the full active-category set in one page,
 * both for the filter dropdown and for deriving each row's execution mode. */
const CATEGORY_FETCH_PAGE_SIZE = 200;

interface CategoryFilterOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-admin-catalog-services',
  imports: [
    TableModule,
    Button,
    Select,
    FormsModule,
    TranslatePipe,
    EurCurrencyPipe,
    ListToolbarComponent,
    StatusTagComponent,
    ServiceFormDialogComponent,
  ],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class CatalogServicesComponent {
  private readonly servicesService = inject(ServicesService);
  private readonly categoriesService = inject(ServiceCategoriesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<ServiceDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly categoryFilter = signal<string | null>(null);

  /** Active categories - needed for both the category filter dropdown here and
   * the category dropdown in the create/edit form (which the dialog loads itself). */
  readonly activeCategories = signal<ServiceCategoryDto[]>([]);
  private readonly activeCategoriesById = computed(
    () => new Map(this.activeCategories().map((category) => [category.id, category])),
  );

  readonly categoryFilterOptions = computed<CategoryFilterOption[]>(() => [
    { label: this.translate.instant('CATALOG.SERVICES.FILTER_CATEGORY_ALL'), value: null },
    ...this.activeCategories().map((category) => ({ label: category.name, value: category.id })),
  ]);

  readonly dialogVisible = signal(false);
  readonly editingService = signal<ServiceDto | null>(null);

  constructor() {
    this.loadActiveCategories();
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

  onCategoryFilterChange(categoryId: string | null): void {
    this.categoryFilter.set(categoryId);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  /** Category isn't on ServiceDto - only serviceCategoryName is. Derived here from
   * the already-loaded active category list; a service whose category has since
   * been deactivated simply shows no execution mode badge. */
  executionModeKeyFor(serviceCategoryId: string): string | null {
    const category = this.activeCategoriesById().get(serviceCategoryId);
    return category ? executionModeTranslationKey(category.executionMode) : null;
  }

  openCreate(): void {
    this.editingService.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(service: ServiceDto): void {
    this.editingService.set(service);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
  }

  activate(service: ServiceDto): void {
    this.servicesService.activate(service.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.SERVICES.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
      },
      error: () => {},
    });
  }

  confirmDeactivate(service: ServiceDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.SERVICES.CONFIRM_DEACTIVATE', {
        name: service.name,
      }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.servicesService.deactivate(service.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.SERVICES.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(service: ServiceDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.SERVICES.CONFIRM_DELETE', { name: service.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.servicesService.delete(service.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.SERVICES.DELETED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.servicesService
      .getPage(
        {
          page,
          pageSize: rows,
          search: this.search() || undefined,
          isActive: this.showInactive() ? undefined : true,
        },
        { extraParams: { serviceCategoryId: this.categoryFilter() } },
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }

  private loadActiveCategories(): void {
    this.categoriesService
      .getPage(
        { page: 1, pageSize: CATEGORY_FETCH_PAGE_SIZE, isActive: true },
        { suppressErrorToast: true },
      )
      .subscribe((result) => this.activeCategories.set(result.items));
  }
}
