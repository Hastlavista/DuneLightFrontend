import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { ServiceCategoryDto } from '../../../../../core/models/service-category.model';
import { ServiceDto, ServiceUpsertRequest } from '../../../../../core/models/service.model';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ServicesService } from '../../../../../core/services/services.service';

const DEFAULT_DURATION_MINUTES = 30;

@Component({
  selector: 'app-service-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    InputText,
    Textarea,
    InputNumber,
    Select,
    Button,
    TranslatePipe,
  ],
  templateUrl: './service-form-dialog.component.html',
})
export class ServiceFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly servicesService = inject(ServicesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly service = input<ServiceDto | null>(null);
  /** Active categories only - the backend rejects an inactive one, so it's never
   * offered here (see ServicesComponent, which loads this list). */
  readonly categories = input<ServiceCategoryDto[]>([]);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.service() !== null);

  /** True only once p-dialog's own open transition has actually finished (its
   * (onShow) event). A p-select created in the SAME tick as that transition ends
   * up with a ControlValueAccessor that doesn't register clicks - a real,
   * reproducible PrimeNG/CDK timing issue in this app's version (see
   * PriceListItemFormDialogComponent, which hit the same thing first). Only
   * rendering the form after onShow sidesteps it entirely. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    serviceCategoryId: ['', Validators.required],
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
      serviceCategoryId: raw.serviceCategoryId,
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

  private resetForm(service: ServiceDto | null): void {
    this.form.reset({
      name: service?.name ?? '',
      serviceCategoryId: service?.serviceCategoryId ?? '',
      defaultDurationMinutes: service?.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES,
      defaultPrice: service?.defaultPrice ?? 0,
      description: service?.description ?? '',
      sortOrder: service?.sortOrder ?? 0,
    });
  }
}
