import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { LocationDto } from '../../../../../../core/models/location.model';
import { PackageDto } from '../../../../../../core/models/package.model';
import {
  EffectivePriceRow,
  PriceListSubjectType,
  PriceSource,
  ResolvePriceResult,
} from '../../../../../../core/models/price-list.model';
import { ServiceDto } from '../../../../../../core/models/service.model';
import { LocationsService } from '../../../../../../core/services/locations.service';
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
  private readonly locationsService = inject(LocationsService);
  private readonly translate = inject(TranslateService);

  private readonly activeServices = signal<ServiceDto[]>([]);
  private readonly activePackages = signal<PackageDto[]>([]);
  private readonly activeLocations = signal<LocationDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly locationOptions = computed<SelectOption[]>(() =>
    this.activeLocations().map((location) => ({ label: location.name, value: location.id })),
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
  readonly effectiveLocationId = signal<string | null>(null);
  readonly effectiveDate = signal<Date>(new Date());
  readonly effectiveRows = signal<EffectivePriceRow[]>([]);
  readonly effectiveLoading = signal(false);

  // "Provjeri cijenu" resolve panel state
  readonly resolveSubjectType = signal<PriceListSubjectType>('Service');
  readonly resolveSubjectId = signal<string | null>(null);
  readonly resolveLocationId = signal<string | null>(null);
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

  onEffectiveLocationChange(locationId: string | null): void {
    this.effectiveLocationId.set(locationId);
    this.fetchEffective();
  }

  onEffectiveDateChange(date: Date): void {
    this.effectiveDate.set(date);
    this.fetchEffective();
  }

  onResolveSubjectTypeChange(type: PriceListSubjectType): void {
    this.resolveSubjectType.set(type);
    this.resolveSubjectId.set(null);
    this.resolveResult.set(null);
  }

  onResolveSubjectChange(subjectId: string | null): void {
    this.resolveSubjectId.set(subjectId);
    this.resolveResult.set(null);
  }

  onResolveLocationChange(locationId: string | null): void {
    this.resolveLocationId.set(locationId);
    this.resolveResult.set(null);
  }

  onResolveDateChange(date: Date): void {
    this.resolveDate.set(date);
    this.resolveResult.set(null);
  }

  onCheckPrice(): void {
    const subjectId = this.resolveSubjectId();
    const locationId = this.resolveLocationId();
    if (!subjectId || !locationId) {
      return;
    }

    this.resolving.set(true);
    this.priceListService
      .resolve({
        subjectType: this.resolveSubjectType(),
        subjectId,
        companyId: locationId,
        date: toStartOfDayIso(this.resolveDate()),
      })
      .pipe(finalize(() => this.resolving.set(false)))
      .subscribe({
        next: (result) => this.resolveResult.set(result),
        error: () => this.resolveResult.set(null),
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
    const locationId = this.effectiveLocationId();
    if (!locationId) {
      this.effectiveRows.set([]);
      return;
    }

    this.effectiveLoading.set(true);
    this.priceListService
      .getEffective(locationId, toStartOfDayIso(this.effectiveDate()))
      .pipe(finalize(() => this.effectiveLoading.set(false)))
      .subscribe((rows) => this.effectiveRows.set(rows));
  }

  private loadLookups(): void {
    this.servicesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeServices.set(result.items));
    this.packagesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activePackages.set(result.items));
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => {
        this.activeLocations.set(result.items);
        const first = result.items[0];
        if (first) {
          this.effectiveLocationId.set(first.id);
          this.resolveLocationId.set(first.id);
          this.fetchEffective();
        }
      });
  }
}
