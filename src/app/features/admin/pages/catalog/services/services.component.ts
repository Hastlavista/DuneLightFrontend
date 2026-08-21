import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
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
    TableModule,
    Button,
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

  @ViewChild('dt') private table!: Table;

  readonly items = signal<ServiceDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
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

  onExecutionModeFilterChange(mode: ServiceExecutionMode | null): void {
    this.executionModeFilter.set(mode);
    this.table.first = 0;
    this.fetch(0, this.rows());
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
    this.activeServicesStore.refresh();
  }

  activate(service: ServiceDto): void {
    this.servicesService.activate(service.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.SERVICES.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
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
            this.fetch(this.table?.first ?? 0, this.rows());
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
            this.fetch(this.table?.first ?? 0, this.rows());
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
}
