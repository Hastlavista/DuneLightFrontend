import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { finalize } from 'rxjs';
import { CompanyDto } from '../../../../../../core/models/company.model';
import {
  EffectivePriceRow,
  PriceListItemDto,
  PriceListSubjectType,
  PriceSource,
  priceListSubjectName,
} from '../../../../../../core/models/price-list.model';
import { ActivePackagesStore } from '../../../../../../core/services/active-packages.store';
import { ActiveServicesStore } from '../../../../../../core/services/active-services.store';
import { CompaniesService } from '../../../../../../core/services/companies.service';
import { CurrentEmployeeService } from '../../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { PriceListService } from '../../../../../../core/services/price-list.service';
import { translationReadySignal } from '../../../../../../core/utils/translation-signal.util';
import { toStartOfDayIso } from '../../../../../../core/utils/date.util';
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
    Button,
    DatePicker,
    Paginator,
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
  private readonly companiesService = inject(CompaniesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly items = signal<PriceListItemDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly first = signal(0);
  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly companyFilter = signal<string | null>(null);
  readonly subjectTypeFilter = signal<PriceListSubjectType | null>(null);
  readonly effectiveCompanyId = signal<string | null>(null);
  readonly effectiveDate = signal<Date>(new Date());
  readonly effectiveRows = signal<EffectivePriceRow[]>([]);
  readonly effectiveLoading = signal(false);

  /** Services/packages preloaded via shared stores (see ActiveServicesStore /
   * ActivePackagesStore) so a create/activate/deactivate/delete on Usluge or
   * Paketi is reflected here without a page reload. Companies aren't shared
   * that way - Lokacije lives on a separate route, so this screen is always
   * freshly mounted (and this fetched fresh) whenever that could matter. */
  readonly activeServices = this.activeServicesStore.services;
  readonly activePackages = this.activePackagesStore.packages;
  readonly activeCompanies = signal<CompanyDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly companyFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CATALOG.PRICING.ALL_COMPANIES'), value: null },
      ...this.activeCompanies().map((company) => ({ label: company.name, value: company.id })),
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

  readonly effectiveCompanyOptions = computed(() =>
    this.activeCompanies().map((company) => ({ label: company.name, value: company.id })),
  );

  readonly dialogVisible = signal(false);
  readonly editingItem = signal<PriceListItemDto | null>(null);

  readonly subjectName = priceListSubjectName;

  constructor() {
    this.loadLookups();
    this.fetch(0, this.rows());
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.resetAndFetch();
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.resetAndFetch();
  }

  onCompanyFilterChange(companyId: string | null): void {
    this.companyFilter.set(companyId);
    this.resetAndFetch();
  }

  onSubjectTypeFilterChange(subjectType: PriceListSubjectType | null): void {
    this.subjectTypeFilter.set(subjectType);
    this.resetAndFetch();
  }

  onEffectiveCompanyChange(companyId: string | null): void {
    this.effectiveCompanyId.set(companyId);
    this.fetchEffective();
  }

  onEffectiveDateChange(date: Date): void {
    this.effectiveDate.set(date);
    this.fetchEffective();
  }

  sourceLabel(source: PriceSource): string {
    return this.translate.instant(`CATALOG.PRICING.SOURCE.${source}`);
  }

  onPageChange(event: PaginatorState): void {
    const rows = event.rows ?? this.rows();
    const first = event.first ?? 0;
    this.rows.set(rows);
    this.first.set(first);
    this.fetch(first, rows);
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
    this.fetch(this.first(), this.rows());
    this.fetchEffective();
  }

  activate(item: PriceListItemDto): void {
    this.priceListService.activate(item.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.PRICING.ACTIVATED'));
        this.fetch(this.first(), this.rows());
        this.fetchEffective();
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
            this.fetch(this.first(), this.rows());
            this.fetchEffective();
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
            this.fetch(this.first(), this.rows());
            this.fetchEffective();
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
            companyId: this.companyFilter(),
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

  private resetAndFetch(): void {
    this.first.set(0);
    this.fetch(0, this.rows());
  }

  private fetchEffective(): void {
    const companyId = this.effectiveCompanyId();
    if (!companyId) {
      this.effectiveRows.set([]);
      return;
    }

    this.effectiveLoading.set(true);
    this.priceListService
      .getEffective(companyId, toStartOfDayIso(this.effectiveDate()))
      .pipe(finalize(() => this.effectiveLoading.set(false)))
      .subscribe({ next: (rows) => this.effectiveRows.set(rows), error: () => this.effectiveRows.set([]) });
  }

  private loadLookups(): void {
    this.companiesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => {
        this.activeCompanies.set(result.items);
        if (!this.effectiveCompanyId() && result.items[0]) {
          this.effectiveCompanyId.set(result.items[0].id);
          this.fetchEffective();
        }
      });
  }
}
