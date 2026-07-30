import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import {
  entryModeTranslationKey,
  PACKAGE_ENTRY_MODES,
  PACKAGE_VALIDITY_TYPES,
  PackageDto,
  PackageEntryMode,
  PackageServiceLinkDto,
  PackageUpsertRequest,
  PackageValidityType,
  validityTypeTranslationKey,
} from '../../../../../../core/models/package.model';
import { ActivePackagesStore } from '../../../../../../core/services/active-packages.store';
import { ActiveServicesStore } from '../../../../../../core/services/active-services.store';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { PackagesService } from '../../../../../../core/services/packages.service';
import { toEndOfDayIso } from '../../../../../../core/utils/date.util';
import { translationReadySignal } from '../../../../../../core/utils/translation-signal.util';

/** Route param sentinel for create mode - see admin.routes.ts (single
 * 'services/packages/:id' route instead of a separate 'new' route). */
const NEW_ID = 'new';

interface EntryModeOption {
  label: string;
  value: PackageEntryMode;
}

interface ValidityTypeOption {
  label: string;
  value: PackageValidityType;
}

export interface ServiceOption {
  id: string;
  name: string;
}

/** Array-level: at least one service, no duplicates. Per-row entryCount
 * requiredness is toggled separately (see applyEntryModeValidators) since it
 * depends on entryMode, not on the array's own shape. */
function servicesArrayValidator(control: AbstractControl): ValidationErrors | null {
  const rows = (control as FormArray).controls;
  if (rows.length === 0) {
    return { noServices: true };
  }
  const ids = rows.map((row) => row.get('serviceId')?.value).filter((id): id is string => !!id);
  if (new Set(ids).size !== ids.length) {
    return { duplicateService: true };
  }
  return null;
}

@Component({
  selector: 'app-admin-package-form',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    InputNumber,
    Select,
    SelectButton,
    DatePicker,
    Checkbox,
    Button,
    TranslatePipe,
  ],
  templateUrl: './package-form.component.html',
  styleUrl: './package-form.component.scss',
})
export class PackageFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly packagesService = inject(PackagesService);
  private readonly activeServicesStore = inject(ActiveServicesStore);
  private readonly activePackagesStore = inject(ActivePackagesStore);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** Shared with Usluge/Cjenik via ActiveServicesStore so a service created,
   * activated, or deactivated there shows up here without a page reload. */
  readonly activeServices = this.activeServicesStore.services;
  /** Services this package links to that are no longer active - kept visible in
   * the picker (with a badge) instead of silently dropped. Derived, not set
   * directly, so it stays correct regardless of whether the package or the
   * active-service list finishes loading first. */
  private readonly loadedPackageServices = signal<PackageServiceLinkDto[]>([]);
  readonly inactiveServiceNames = computed(() => {
    const activeIds = new Set(this.activeServices().map((service) => service.id));
    const names = new Map<string, string>();
    for (const link of this.loadedPackageServices()) {
      if (!activeIds.has(link.serviceId)) {
        names.set(link.serviceId, link.serviceName);
      }
    }
    return names;
  });

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly entryModeOptions = computed<EntryModeOption[]>(() => {
    this.translationsReady();
    return PACKAGE_ENTRY_MODES.map((mode) => ({
      label: this.translate.instant(entryModeTranslationKey(mode)),
      value: mode,
    }));
  });

  readonly validityTypeOptions = computed<ValidityTypeOption[]>(() => {
    this.translationsReady();
    return PACKAGE_VALIDITY_TYPES.map((type) => ({
      label: this.translate.instant(validityTypeTranslationKey(type)),
      value: type,
    }));
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    defaultPrice: [0, [Validators.required, Validators.min(0)]],
    sortOrder: [0],
    entryMode: this.fb.nonNullable.control<PackageEntryMode>('SharedPool', Validators.required),
    totalEntryCount: this.fb.control<number | null>(null),
    unlimited: [false],
    validityType: this.fb.nonNullable.control<PackageValidityType>('DayCount', Validators.required),
    validityDays: this.fb.control<number | null>(null),
    validityFixedDate: this.fb.control<Date | null>(null),
    services: this.fb.array<FormGroup>([], servicesArrayValidator),
  });

  get servicesArray(): FormArray {
    return this.form.controls.services;
  }

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam && idParam !== NEW_ID ? idParam : null;
    this.editingId.set(id);

    if (id) {
      this.loadPackage(id);
    } else {
      this.addServiceRow();
      this.applyEntryModeValidators('SharedPool');
      this.applyValidityValidators('DayCount');
    }

    // User-driven switches only - resetForm()/applyPackage() patch with
    // emitEvent: false so loading a package doesn't trigger these.
    this.form.controls.entryMode.valueChanges.subscribe((mode) => this.onEntryModeChange(mode));
    this.form.controls.validityType.valueChanges.subscribe((type) => this.onValidityTypeChange(type));
    this.form.controls.unlimited.valueChanges.subscribe((unlimited) => this.onUnlimitedChange(unlimited));
  }

  addServiceRow(serviceId = '', entryCount: number | null = null): void {
    const group = this.fb.nonNullable.group({
      serviceId: this.fb.nonNullable.control(serviceId, Validators.required),
      entryCount: this.fb.control<number | null>(entryCount),
    });
    if (this.form.controls.entryMode.value === 'PerService') {
      group.controls.entryCount.setValidators([Validators.required, Validators.min(1)]);
    }
    this.servicesArray.push(group);
    this.servicesArray.updateValueAndValidity();
  }

  removeServiceRow(index: number): void {
    this.servicesArray.removeAt(index);
    this.servicesArray.updateValueAndValidity();
  }

  /** Active services not already picked by another row, plus this row's own
   * currently-selected service even if it has since been deactivated (labelled). */
  optionsForRow(index: number): ServiceOption[] {
    const rows = this.servicesArray.controls;
    const ownId = rows[index]?.get('serviceId')?.value as string;
    const takenByOthers = new Set(
      rows
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row) => row.get('serviceId')?.value)
        .filter(Boolean),
    );

    const options = this.activeServices()
      .filter((service) => !takenByOthers.has(service.id))
      .map((service) => ({ id: service.id, name: service.name }));

    const inactiveName = this.inactiveServiceNames().get(ownId);
    if (inactiveName && !options.some((option) => option.id === ownId)) {
      const badge = this.translate.instant('CATALOG.PACKAGES.INACTIVE_SERVICE_BADGE');
      options.unshift({ id: ownId, name: `${inactiveName} (${badge})` });
    }

    return options;
  }

  canAddService(): boolean {
    const taken = new Set(
      this.servicesArray.controls.map((row) => row.get('serviceId')?.value).filter(Boolean),
    );
    return this.activeServices().some((service) => !taken.has(service.id));
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request = this.toUpsertRequest();
    const id = this.editingId();
    const request$ = id ? this.packagesService.update(id, request) : this.packagesService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(id ? 'CATALOG.PACKAGES.UPDATED' : 'CATALOG.PACKAGES.CREATED'),
        );
        this.activePackagesStore.refresh();
        this.navigateBack();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.navigateBack();
  }

  private onEntryModeChange(mode: PackageEntryMode): void {
    if (mode === 'SharedPool') {
      for (const row of this.servicesArray.controls) {
        (row as FormGroup).controls['entryCount'].reset(null, { emitEvent: false });
      }
    } else {
      this.form.controls.totalEntryCount.reset(null, { emitEvent: false });
      this.form.controls.unlimited.reset(false, { emitEvent: false });
      this.form.controls.totalEntryCount.enable({ emitEvent: false });
    }
    this.applyEntryModeValidators(mode);
  }

  private onValidityTypeChange(type: PackageValidityType): void {
    if (type !== 'DayCount') {
      this.form.controls.validityDays.reset(null, { emitEvent: false });
    }
    if (type !== 'FixedDate') {
      this.form.controls.validityFixedDate.reset(null, { emitEvent: false });
    }
    this.applyValidityValidators(type);
  }

  private onUnlimitedChange(unlimited: boolean): void {
    if (unlimited) {
      this.form.controls.totalEntryCount.disable({ emitEvent: false });
    } else {
      this.form.controls.totalEntryCount.enable({ emitEvent: false });
    }
    this.applyEntryModeValidators(this.form.controls.entryMode.value);
  }

  private applyEntryModeValidators(mode: PackageEntryMode): void {
    const totalEntryCount = this.form.controls.totalEntryCount;
    if (mode === 'SharedPool' && !this.form.controls.unlimited.value) {
      totalEntryCount.setValidators([Validators.required, Validators.min(1)]);
    } else {
      totalEntryCount.clearValidators();
    }
    totalEntryCount.updateValueAndValidity({ emitEvent: false });

    for (const row of this.servicesArray.controls) {
      const entryCount = (row as FormGroup).controls['entryCount'];
      if (mode === 'PerService') {
        entryCount.setValidators([Validators.required, Validators.min(1)]);
      } else {
        entryCount.clearValidators();
      }
      entryCount.updateValueAndValidity({ emitEvent: false });
    }
  }

  private applyValidityValidators(type: PackageValidityType): void {
    const days = this.form.controls.validityDays;
    const fixedDate = this.form.controls.validityFixedDate;
    days.setValidators(type === 'DayCount' ? [Validators.required, Validators.min(1)] : []);
    fixedDate.setValidators(type === 'FixedDate' ? [Validators.required] : []);
    days.updateValueAndValidity({ emitEvent: false });
    fixedDate.updateValueAndValidity({ emitEvent: false });
  }

  private toUpsertRequest(): PackageUpsertRequest {
    const raw = this.form.getRawValue();
    return {
      name: raw.name,
      description: raw.description || null,
      entryMode: raw.entryMode,
      totalEntryCount: raw.entryMode === 'SharedPool' && !raw.unlimited ? raw.totalEntryCount : null,
      validityType: raw.validityType,
      validityDays: raw.validityType === 'DayCount' ? raw.validityDays : null,
      validityFixedDate:
        raw.validityType === 'FixedDate' && raw.validityFixedDate
          ? toEndOfDayIso(raw.validityFixedDate)
          : null,
      defaultPrice: raw.defaultPrice,
      sortOrder: raw.sortOrder,
      services: raw.services.map((row) => ({
        serviceId: row['serviceId'],
        entryCount: raw.entryMode === 'PerService' ? row['entryCount'] : null,
      })),
    };
  }

  private loadPackage(id: string): void {
    this.loading.set(true);
    this.packagesService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (pkg) => this.applyPackage(pkg),
        error: () => this.navigateBack(),
      });
  }

  private applyPackage(pkg: PackageDto): void {
    this.loadedPackageServices.set(pkg.services);

    this.servicesArray.clear();
    for (const link of pkg.services) {
      this.addServiceRow(link.serviceId, link.entryCount);
    }

    const unlimited = pkg.entryMode === 'SharedPool' && pkg.totalEntryCount == null;

    this.form.reset(
      {
        name: pkg.name,
        description: pkg.description ?? '',
        defaultPrice: pkg.defaultPrice,
        sortOrder: pkg.sortOrder,
        entryMode: pkg.entryMode,
        totalEntryCount: pkg.totalEntryCount,
        unlimited,
        validityType: pkg.validityType,
        validityDays: pkg.validityDays,
        validityFixedDate: pkg.validityFixedDate ? new Date(pkg.validityFixedDate) : null,
        services: pkg.services.map((link) => ({ serviceId: link.serviceId, entryCount: link.entryCount })),
      },
      { emitEvent: false },
    );

    if (unlimited) {
      this.form.controls.totalEntryCount.disable({ emitEvent: false });
    }

    this.applyEntryModeValidators(pkg.entryMode);
    this.applyValidityValidators(pkg.validityType);
  }

  private navigateBack(): void {
    this.router.navigate(['/admin/services'], { queryParams: { tab: 'packages' } });
  }
}
