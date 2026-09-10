import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { finalize } from 'rxjs';
import { EXECUTION_MODES, ServiceDto, ServiceExecutionMode, executionModeTranslationKey } from '../../../../../core/models/service.model';
import { ActiveServicesStore } from '../../../../../core/services/active-services.store';
import { ServicesService } from '../../../../../core/services/services.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ColorSwatchComponent } from '../../../../../shared/components/color-swatch/color-swatch.component';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { EurCurrencyPipe } from '../../../../../shared/pipes/eur-currency.pipe';
import { ServiceFormDialogComponent } from './service-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

interface ExecutionModeFilterOption {
  label: string;
  value: ServiceExecutionMode | null;
}

@Component({
  selector: 'app-admin-catalog-services',
  imports: [
    Button,
    Paginator,
    Select,
    FormsModule,
    TranslatePipe,
    EurCurrencyPipe,
    ListToolbarComponent,
    StatusTagComponent,
    ColorSwatchComponent,
    ServiceFormDialogComponent,
  ],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class CatalogServicesComponent {
  private readonly servicesService = inject(ServicesService);
  private readonly activeServicesStore = inject(ActiveServicesStore);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly items = signal<ServiceDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly first = signal(0);
  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly executionModeFilter = signal<ServiceExecutionMode | null>(null);

  readonly executionModeTranslationKey = executionModeTranslationKey;

  readonly executionModeFilterOptions = computed<ExecutionModeFilterOption[]>(() => [
    { label: this.translate.instant('CATALOG.SERVICES.FILTER_EXECUTION_MODE_ALL'), value: null },
    ...EXECUTION_MODES.map((mode) => ({ label: this.translate.instant(executionModeTranslationKey(mode)), value: mode })),
  ]);

  readonly dialogVisible = signal(false);
  readonly editingService = signal<ServiceDto | null>(null);

  constructor() {
    this.fetch(0, this.rows());
    if (this.route.snapshot.queryParamMap.get('create') === 'service') {
      this.openCreate();
    }
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.resetAndFetch();
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.resetAndFetch();
  }

  onExecutionModeFilterChange(mode: ServiceExecutionMode | null): void {
    this.executionModeFilter.set(mode);
    this.resetAndFetch();
  }

  onPageChange(event: PaginatorState): void {
    const rows = event.rows ?? this.rows();
    const first = event.first ?? 0;
    this.rows.set(rows);
    this.first.set(first);
    this.fetch(first, rows);
  }

  openCreate(): void {
    this.editingService.set(null);
    this.dialogVisible.set(true);
  }

  onDialogVisibleChange(visible: boolean): void {
    this.dialogVisible.set(visible);
    if (!visible && this.route.snapshot.queryParamMap.get('create') === 'service') {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { create: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  openEdit(service: ServiceDto): void {
    this.editingService.set(service);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.first(), this.rows());
    this.activeServicesStore.refresh();
  }

  activate(service: ServiceDto): void {
    this.servicesService.activate(service.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.SERVICES.ACTIVATED'));
        this.fetch(this.first(), this.rows());
        this.activeServicesStore.refresh();
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
            this.fetch(this.first(), this.rows());
            this.activeServicesStore.refresh();
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
            this.fetch(this.first(), this.rows());
            this.activeServicesStore.refresh();
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
        { extraParams: { executionMode: this.executionModeFilter() } },
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }

  initials(service: ServiceDto): string {
    return service.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  private resetAndFetch(): void {
    this.first.set(0);
    this.fetch(0, this.rows());
  }
}
