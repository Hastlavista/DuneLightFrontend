import { Component, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { ServiceCategoryDto, executionModeTranslationKey } from '../../../../../core/models/service-category.model';
import { ActiveServiceCategoriesStore } from '../../../../../core/services/active-service-categories.store';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ServiceCategoriesService } from '../../../../../core/services/service-categories.service';
import { ColorSwatchComponent } from '../../../../../shared/components/color-swatch/color-swatch.component';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { CategoryFormDialogComponent } from './category-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-service-categories',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    ColorSwatchComponent,
    CategoryFormDialogComponent,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent {
  private readonly categoriesService = inject(ServiceCategoriesService);
  private readonly activeCategoriesStore = inject(ActiveServiceCategoriesStore);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<ServiceCategoryDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly dialogVisible = signal(false);
  readonly editingCategory = signal<ServiceCategoryDto | null>(null);

  readonly executionModeTranslationKey = executionModeTranslationKey;

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
    this.editingCategory.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(category: ServiceCategoryDto): void {
    this.editingCategory.set(category);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
    this.activeCategoriesStore.refresh();
  }

  activate(category: ServiceCategoryDto): void {
    this.categoriesService.activate(category.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.CATEGORIES.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
        this.activeCategoriesStore.refresh();
      },
      error: () => {},
    });
  }

  confirmDeactivate(category: ServiceCategoryDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.CATEGORIES.CONFIRM_DEACTIVATE', { name: category.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.categoriesService.deactivate(category.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.CATEGORIES.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
            this.activeCategoriesStore.refresh();
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(category: ServiceCategoryDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.CATEGORIES.CONFIRM_DELETE', { name: category.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.categoriesService.delete(category.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.CATEGORIES.DELETED'));
            this.fetch(this.table?.first ?? 0, this.rows());
            this.activeCategoriesStore.refresh();
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.categoriesService
      .getPage({
        page,
        pageSize: rows,
        search: this.search() || undefined,
        isActive: this.showInactive() ? undefined : true,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
