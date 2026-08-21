import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { finalize } from 'rxjs';
import { LocationDto } from '../../../../../../core/models/location.model';
import { PackageDto } from '../../../../../../core/models/package.model';
import {
  PriceListCreateRequest,
  PriceListItemDto,
  PriceListSubjectType,
  PriceListUpdateRequest,
} from '../../../../../../core/models/price-list.model';
import { ServiceDto } from '../../../../../../core/models/service.model';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { PriceListService } from '../../../../../../core/services/price-list.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../../../../core/utils/date.util';
import { translationReadySignal } from '../../../../../../core/utils/translation-signal.util';

interface SubjectTypeOption {
  label: string;
  value: PriceListSubjectType;
}

interface LocationOption {
  label: string;
  value: string;
}

/** "" = "sve lokacije" - a real, sendable value (locationId omitted), not "no
 * selection". Deliberately not `null`: p-select's value matching gets unreliable
 * once one of the option values is null (it also uses null/undefined internally
 * to mean "nothing selected yet"). */
const ALL_LOCATIONS_VALUE = '';

interface PriceListFormRawValue {
  subjectType: PriceListSubjectType;
  serviceId: string | null;
  packageId: string | null;
  locationId: string;
  price: number;
  validFrom: Date;
  validTo: Date | null;
}

/** Cross-field: exactly one of serviceId/packageId is required, matching whichever
 * subjectType is selected. A single group-level validator (recomputed automatically
 * whenever any child control changes) instead of toggling Validators.required on/off
 * per control - simpler, and avoids having to manually re-run updateValueAndValidity(). */
function subjectRequiredValidator(group: AbstractControl): ValidationErrors | null {
  const subjectType = group.get('subjectType')?.value as PriceListSubjectType;
  if (subjectType === 'Service' && !group.get('serviceId')?.value) {
    return { serviceRequired: true };
  }
  if (subjectType === 'Package' && !group.get('packageId')?.value) {
    return { packageRequired: true };
  }
  return null;
}

@Component({
  selector: 'app-price-list-item-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    Select,
    SelectButton,
    InputNumber,
    DatePicker,
    Button,
    TranslatePipe,
  ],
  templateUrl: './price-list-item-form-dialog.component.html',
})
export class PriceListItemFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly priceListService = inject(PriceListService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly item = input<PriceListItemDto | null>(null);
  /** Active-only lists - the backend rejects an inactive subject with NOT_FOUND,
   * so neither is ever offered here (see PriceListItemsComponent, which loads
   * these). */
  readonly activeServices = input<ServiceDto[]>([]);
  readonly activePackages = input<PackageDto[]>([]);
  readonly activeLocations = input<LocationDto[]>([]);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.item() !== null);

  /** True only once p-dialog's own open transition has actually finished (its
   * (onShow) event). Fields created in the SAME tick as that transition (e.g.
   * the very first render of the always-mounted serviceId/locationId selects)
   * end up with a ControlValueAccessor that doesn't register clicks - a real,
   * reproducible PrimeNG/CDK timing issue in this app's version, not a forms
   * logic bug (already ruled out: validators, sentinel values, appendTo). Only
   * rendering the form after onShow sidesteps it entirely. */
  readonly dialogShown = signal(false);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly subjectTypeOptions = computed<SubjectTypeOption[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CATALOG.PRICING.SUBJECT_TYPE.SERVICE'), value: 'Service' },
      { label: this.translate.instant('CATALOG.PRICING.SUBJECT_TYPE.PACKAGE'), value: 'Package' },
    ];
  });

  readonly locationOptions = computed<LocationOption[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CATALOG.PRICING.ALL_LOCATIONS'), value: ALL_LOCATIONS_VALUE },
      ...this.activeLocations().map((location) => ({ label: location.name, value: location.id })),
    ];
  });

  readonly form = this.fb.nonNullable.group(
    {
      subjectType: this.fb.nonNullable.control<PriceListSubjectType>('Service', Validators.required),
      serviceId: this.fb.control<string | null>(null),
      packageId: this.fb.control<string | null>(null),
      locationId: this.fb.nonNullable.control<string>(ALL_LOCATIONS_VALUE),
      price: [0, [Validators.required, Validators.min(0)]],
      validFrom: this.fb.nonNullable.control<Date>(new Date(), Validators.required),
      validTo: this.fb.control<Date | null>(null),
    },
    { validators: subjectRequiredValidator },
  );

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.item());
      } else {
        // Reset for the next open - dialogShown flips back to true once
        // p-dialog's (onShow) fires again.
        this.dialogShown.set(false);
      }
    });

    // Only fires on genuine user interaction with the segmented control -
    // resetForm() below resets with emitEvent: false so it doesn't wipe the
    // service/package it just set. subjectRequiredValidator picks up the new
    // subjectType automatically, no manual validator toggling needed here.
    this.form.controls.subjectType.valueChanges.subscribe(() => {
      this.form.patchValue({ serviceId: null, packageId: null });
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw: PriceListFormRawValue = this.form.getRawValue();
    const current = this.item();
    const request$ = current
      ? this.priceListService.update(current.id, this.toUpdateRequest(raw))
      : this.priceListService.create(this.toCreateRequest(raw));

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'CATALOG.PRICING.UPDATED' : 'CATALOG.PRICING.CREATED'),
        );
        this.visible.set(false);
        this.saved.emit();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  private toCreateRequest(raw: PriceListFormRawValue): PriceListCreateRequest {
    return {
      subjectType: raw.subjectType,
      serviceId: raw.subjectType === 'Service' ? (raw.serviceId ?? undefined) : undefined,
      packageId: raw.subjectType === 'Package' ? (raw.packageId ?? undefined) : undefined,
      companyId: raw.locationId || undefined,
      price: raw.price,
      validFrom: toStartOfDayIso(raw.validFrom),
      validTo: raw.validTo ? toEndOfDayIso(raw.validTo) : undefined,
    };
  }

  private toUpdateRequest(raw: PriceListFormRawValue): PriceListUpdateRequest {
    return {
      price: raw.price,
      validFrom: toStartOfDayIso(raw.validFrom),
      validTo: raw.validTo ? toEndOfDayIso(raw.validTo) : undefined,
    };
  }

  private resetForm(item: PriceListItemDto | null): void {
    const subjectType = item?.subjectType ?? 'Service';

    this.form.reset(
      {
        subjectType,
        serviceId: item?.serviceId ?? null,
        packageId: item?.packageId ?? null,
        locationId: item?.companyId ?? ALL_LOCATIONS_VALUE,
        price: item?.price ?? 0,
        validFrom: item ? new Date(item.validFrom) : new Date(),
        validTo: item?.validTo ? new Date(item.validTo) : null,
      },
      { emitEvent: false },
    );

    // Subject and location are immutable after creation - lock them in edit
    // mode instead of sending them in PriceListUpdateRequest.
    const lockedFields = [
      this.form.controls.subjectType,
      this.form.controls.serviceId,
      this.form.controls.packageId,
      this.form.controls.locationId,
    ];
    for (const control of lockedFields) {
      if (item) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
  }
}
