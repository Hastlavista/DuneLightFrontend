import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { CompanyDto } from '../../../../../../core/models/company.model';
import { PackageDto } from '../../../../../../core/models/package.model';
import {
  EffectivePriceRow,
  PriceListSubjectType,
  PriceSource,
  ResolvePriceResult,
} from '../../../../../../core/models/price-list.model';
import { ServiceDto } from '../../../../../../core/models/service.model';
import { CompaniesService } from '../../../../../../core/services/companies.service';
import { PackagesService } from '../../../../../../core/services/packages.service';
import { PriceListService } from '../../../../../../core/services/price-list.service';
import { ServicesService } from '../../../../../../core/services/services.service';
import { toStartOfDayIso } from '../../../../../../core/utils/date.util';
import { translationReadySignal } from '../../../../../../core/utils/translation-signal.util';
import { EurCurrencyPipe } from '../../../../../../shared/pipes/eur-currency.pipe';

const LOOKUP_PAGE_SIZE = 200;

interface SelectOption {
  label: string;
  value: string;
}

/** Read-only "Trenutni cjenik" (effective) view + "provjeri cijenu" (resolve)
 * checker - the second sub-tab of Cjenik (see PricingComponent). Unlike Tab 1,
 * this never writes anything; it only calls GET /price-list/effective and
 * GET /price-list/resolve. */
@Component({
  selector: 'app-admin-effective-price-list',
  imports: [FormsModule, TranslatePipe, Select, DatePicker, SelectButton, Button, Tag, EurCurrencyPipe],
  templateUrl: './effective-price-list.component.html',
  styleUrl: './effective-price-list.component.scss',
})
export class EffectivePriceListComponent {
  private readonly priceListService = inject(PriceListService);
  private readonly servicesService = inject(ServicesService);
  private readonly packagesService = inject(PackagesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly translate = inject(TranslateService);

  private readonly activeServices = signal<ServiceDto[]>([]);
  private readonly activePackages = signal<PackageDto[]>([]);
  private readonly activeCompanies = signal<CompanyDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly companyOptions = computed<SelectOption[]>(() =>
    this.activeCompanies().map((company) => ({ label: company.name, value: company.id })),
  );

  readonly subjectTypeOptions = computed(() => {
    this.translationsReady();
    return [
      {
        label: this.translate.instant('CATALOG.PRICING.SUBJECT_TYPE.SERVICE'),
        value: 'Service' as PriceListSubjectType,
      },
      {
        label: this.translate.instant('CATALOG.PRICING.SUBJECT_TYPE.PACKAGE'),
        value: 'Package' as PriceListSubjectType,
      },
    ];
  });

  // "Trenutni cjenik" view state
  readonly effectiveCompanyId = signal<string | null>(null);
  readonly effectiveDate = signal<Date>(new Date());
  readonly effectiveRows = signal<EffectivePriceRow[]>([]);
  readonly effectiveLoading = signal(false);

  // "Provjeri cijenu" resolve panel state
  readonly resolveSubjectType = signal<PriceListSubjectType>('Service');
  readonly resolveSubjectId = signal<string | null>(null);
  readonly resolveCompanyId = signal<string | null>(null);
  readonly resolveDate = signal<Date>(new Date());
  readonly resolveResult = signal<ResolvePriceResult | null>(null);
  readonly resolving = signal(false);

  readonly resolveSubjectOptions = computed<SelectOption[]>(() =>
    this.resolveSubjectType() === 'Service'
      ? this.activeServices().map((service) => ({ label: service.name, value: service.id }))
      : this.activePackages().map((pkg) => ({ label: pkg.name, value: pkg.id })),
  );

  constructor() {
    this.loadLookups();
  }

  onEffectiveCompanyChange(companyId: string | null): void {
    this.effectiveCompanyId.set(companyId);
    this.fetchEffective();
  }

  onEffectiveDateChange(date: Date): void {
    this.effectiveDate.set(date);
    this.fetchEffective();
  }

  onResolveSubjectTypeChange(type: PriceListSubjectType): void {
    this.resolveSubjectType.set(type);
    this.resolveSubjectId.set(null);
    this.resolveToken++;
    this.resolveResult.set(null);
    this.resolving.set(false);
  }

  onResolveSubjectChange(subjectId: string | null): void {
    this.resolveSubjectId.set(subjectId);
    this.resolveToken++;
    this.resolveResult.set(null);
    this.resolving.set(false);
  }

  onResolveCompanyChange(companyId: string | null): void {
    this.resolveCompanyId.set(companyId);
    this.resolveToken++;
    this.resolveResult.set(null);
    this.resolving.set(false);
  }

  onResolveDateChange(date: Date): void {
    this.resolveDate.set(date);
    this.resolveToken++;
    this.resolveResult.set(null);
    this.resolving.set(false);
  }

  // Latest-request-wins: changing an input while a check is running discards its result.
  private resolveToken = 0;
  private effectiveToken = 0;

  onCheckPrice(): void {
    const subjectId = this.resolveSubjectId();
    const companyId = this.resolveCompanyId();
    if (!subjectId || !companyId) {
      return;
    }

    const token = ++this.resolveToken;
    this.resolving.set(true);
    this.priceListService
      .resolve({
        subjectType: this.resolveSubjectType(),
        subjectId,
        companyId: companyId,
        date: toStartOfDayIso(this.resolveDate()),
      })
      .pipe(
        finalize(() => {
          if (token === this.resolveToken) {
            this.resolving.set(false);
          }
        }),
      )
      .subscribe({
        next: (result) => {
          if (token === this.resolveToken) {
            this.resolveResult.set(result);
          }
        },
        error: () => {
          if (token === this.resolveToken) {
            this.resolveResult.set(null);
          }
        },
      });
  }

  sourceLabel(source: PriceSource): string {
    return this.translate.instant(`CATALOG.PRICING.SOURCE.${source}`);
  }

  sourceSeverity(source: PriceSource): 'success' | 'info' | 'secondary' {
    switch (source) {
      case 'CompanySpecific':
        return 'success';
      case 'AllCompanies':
        return 'info';
      default:
        return 'secondary';
    }
  }

  private fetchEffective(): void {
    const token = ++this.effectiveToken;
    const companyId = this.effectiveCompanyId();
    if (!companyId) {
      this.effectiveRows.set([]);
      this.effectiveLoading.set(false);
      return;
    }

    this.effectiveLoading.set(true);
    this.priceListService
      .getEffective(companyId, toStartOfDayIso(this.effectiveDate()))
      .pipe(
        finalize(() => {
          if (token === this.effectiveToken) {
            this.effectiveLoading.set(false);
          }
        }),
      )
      .subscribe((rows) => {
        if (token === this.effectiveToken) {
          this.effectiveRows.set(rows);
        }
      });
  }

  private loadLookups(): void {
    this.servicesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeServices.set(result.items));
    this.packagesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activePackages.set(result.items));
    this.companiesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => {
        this.activeCompanies.set(result.items);
        const first = result.items[0];
        if (first) {
          this.effectiveCompanyId.set(first.id);
          this.resolveCompanyId.set(first.id);
          this.fetchEffective();
        }
      });
  }
}
