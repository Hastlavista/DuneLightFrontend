import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import {
  EXECUTION_MODES,
  ServiceDto,
  ServiceExecutionMode,
  ServiceUpsertRequest,
  executionModeTranslationKey,
} from '../../../../../core/models/service.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ServicesService } from '../../../../../core/services/services.service';

const DEFAULT_DURATION_MINUTES = 30;

/** Olive-gold from the dune palette - a sensible default when creating a new
 * service, before the user picks their own color. */
const DEFAULT_COLOR_NO_HASH = '8F7A45';

interface ExecutionModeOption {
  label: string;
  value: ServiceExecutionMode;
}

interface ServiceColorOption {
  label: string;
  value: string;
}

const SERVICE_COLORS: ServiceColorOption[] = [
  { label: 'Teal', value: '0F6871' },
  { label: 'Svijetli teal', value: '168A91' },
  { label: 'Burgundy', value: '96384B' },
  { label: 'Dusty rose', value: '826365' },
  { label: 'Slate', value: '555B68' },
  { label: 'Mint', value: 'A9DDC3' },
];

@Component({
  selector: 'app-service-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    InputText,
    InputNumber,
    ColorPicker,
    Select,
    Button,
    TranslatePipe,
  ],
  templateUrl: './service-form-dialog.component.html',
  styleUrl: './service-form-dialog.component.scss',
})
export class ServiceFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly servicesService = inject(ServicesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly service = input<ServiceDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.service() !== null);
  readonly colorOptions = SERVICE_COLORS;
  readonly executionModeTranslationKey = executionModeTranslationKey;

  readonly executionModeOptions = computed<ExecutionModeOption[]>(() =>
    EXECUTION_MODES.map((mode) => ({ label: this.translate.instant(executionModeTranslationKey(mode)), value: mode })),
  );

  /** True only once p-dialog's own open transition has actually finished (its
   * (onShow) event). A p-select created in the SAME tick as that transition ends
   * up with a ControlValueAccessor that doesn't register clicks - a real,
   * reproducible PrimeNG/CDK timing issue in this app's version (see
   * PriceListItemFormDialogComponent, which hit the same thing first). Only
   * rendering the form after onShow sidesteps it entirely. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    executionMode: ['Individual' as ServiceExecutionMode, Validators.required],
    colorHex: [DEFAULT_COLOR_NO_HASH],
    defaultDurationMinutes: [DEFAULT_DURATION_MINUTES, [Validators.required, Validators.min(1)]],
    defaultPrice: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.service());
      } else {
        // Reset for the next open - dialogShown flips back to true once
        // p-dialog's (onShow) fires again.
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: ServiceUpsertRequest = {
      name: raw.name,
      executionMode: raw.executionMode,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      defaultDurationMinutes: raw.defaultDurationMinutes,
      defaultPrice: raw.defaultPrice,
      description: raw.description || null,
      sortOrder: raw.sortOrder,
    };

    const current = this.service();
    const request$ = current
      ? this.servicesService.update(current.id, request)
      : this.servicesService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'CATALOG.SERVICES.UPDATED' : 'CATALOG.SERVICES.CREATED'),
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

  selectColor(colorHex: string): void {
    this.form.controls.colorHex.setValue(colorHex);
  }

  private resetForm(service: ServiceDto | null): void {
    this.form.reset({
      name: service?.name ?? '',
      executionMode: service?.executionMode ?? 'Individual',
      colorHex: service?.colorHex ? service.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      defaultDurationMinutes: service?.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES,
      defaultPrice: service?.defaultPrice ?? 0,
      description: service?.description ?? '',
      sortOrder: service?.sortOrder ?? 0,
    });
  }
}
