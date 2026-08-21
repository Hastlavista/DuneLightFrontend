import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { LocationDto } from '../../../../../../core/models/location.model';
import {
  PriceListItemDto,
  PriceListSubjectType,
  priceListSubjectName,
} from '../../../../../../core/models/price-list.model';
import { ActivePackagesStore } from '../../../../../../core/services/active-packages.store';
import { ActiveServicesStore } from '../../../../../../core/services/active-services.store';
import { LocationsService } from '../../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { PriceListService } from '../../../../../../core/services/price-list.service';
import { translationReadySignal } from '../../../../../../core/utils/translation-signal.util';
import { ListToolbarComponent } from '../../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../../shared/components/status-tag/status-tag.component';
import { EurCurrencyPipe } from '../../../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../../../shared/pipes/hr-date.pipe';
import { PriceListItemFormDialogComponent } from './price-list-item-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;
/** pageSize max is 200 - fetches the full active set in one page, both for the
 * filter dropdowns here and the form's dropdowns (same pattern as Usluge -
 * see catalog/services/services.component.ts). */
const LOOKUP_PAGE_SIZE = 200;

interface FilterOption<T> {
  label: string;
  value: T | null;
}

@Component({
  selector: 'app-admin-price-list-items',
  imports: [
    TableModule,
    Button,
    Select,
    FormsModule,
    TranslatePipe,
    EurCurrencyPipe,
    HrDatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    PriceListItemFormDialogComponent,
  ],
  templateUrl: './price-list-items.component.html',
  styleUrl: './price-list-items.component.scss',
})
export class PriceListItemsComponent {
  private readonly priceListService = inject(PriceListService);
  private readonly activeServicesStore = inject(ActiveServicesStore);
  private readonly activePackagesStore = inject(ActivePackagesStore);
  private readonly locationsService = inject(LocationsService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<PriceListItemDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly locationFilter = signal<string | null>(null);
  readonly subjectTypeFilter = signal<PriceListSubjectType | null>(null);

  /** Services/packages preloaded via shared stores (see ActiveServicesStore /
   * ActivePackagesStore) so a create/activate/deactivate/delete on Usluge or
   * Paketi is reflected here without a page reload. Locations aren't shared
   * that way - Lokacije lives on a separate route, so this screen is always
   * freshly mounted (and this fetched fresh) whenever that could matter. */
  readonly activeServices = this.activeServicesStore.services;
  readonly activePackages = this.activePackagesStore.packages;
  readonly activeLocations = signal<LocationDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly locationFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CATALOG.PRICING.ALL_LOCATIONS'), value: null },
      ...this.activeLocations().map((location) => ({ label: location.name, value: location.id })),
    ];
  });

  readonly subjectTypeFilterOptions = computed<FilterOption<PriceListSubjectType>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CATALOG.PRICING.FILTER_SUBJECT_TYPE_ALL'), value: null },
      { label: this.translate.instant('CATALOG.PRICING.SUBJECT_TYPE.SERVICE'), value: 'Service' },
      { label: this.translate.instant('CATALOG.PRICING.SUBJECT_TYPE.PACKAGE'), value: 'Package' },
    ];
  });

  readonly dialogVisible = signal(false);
  readonly editingItem = signal<PriceListItemDto | null>(null);

  readonly subjectName = priceListSubjectName;

  constructor() {
    this.loadLookups();
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

  onLocationFilterChange(locationId: string | null): void {
    this.locationFilter.set(locationId);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onSubjectTypeFilterChange(subjectType: PriceListSubjectType | null): void {
    this.subjectTypeFilter.set(subjectType);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  openCreate(): void {
    this.editingItem.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(item: PriceListItemDto): void {
    this.editingItem.set(item);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
  }

  activate(item: PriceListItemDto): void {
    this.priceListService.activate(item.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.PRICING.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
      },
      error: () => {},
    });
  }

  confirmDeactivate(item: PriceListItemDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.PRICING.CONFIRM_DEACTIVATE', {
        name: this.subjectName(item),
      }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.priceListService.deactivate(item.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.PRICING.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(item: PriceListItemDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.PRICING.CONFIRM_DELETE', {
        name: this.subjectName(item),
      }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.priceListService.delete(item.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.PRICING.DELETED'));
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
    this.priceListService
      .getPage(
        {
          page,
          pageSize: rows,
          search: this.search() || undefined,
          isActive: this.showInactive() ? undefined : true,
        },
        {
          extraParams: {
            companyId: this.locationFilter(),
            subjectType: this.subjectTypeFilter(),
          },
        },
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }

  private loadLookups(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }
}
