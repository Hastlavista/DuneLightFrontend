import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ColorPicker } from 'primeng/colorpicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import {
  EXECUTION_MODES,
  ServiceCategoryDto,
  ServiceCategoryUpsertRequest,
  ServiceExecutionMode,
  executionModeTranslationKey,
} from '../../../../../core/models/service-category.model';
import { ServiceCategoriesService } from '../../../../../core/services/service-categories.service';
import { NotificationService } from '../../../../../core/services/notification.service';

/** Olive-gold from the dune palette - a sensible default when creating a new
 * category, before the user picks their own color. */
const DEFAULT_COLOR_NO_HASH = '8F7A45';

interface ExecutionModeOption {
  label: string;
  value: ServiceExecutionMode;
}

@Component({
  selector: 'app-category-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    InputText,
    Textarea,
    InputNumber,
    ColorPicker,
    Select,
    Checkbox,
    Button,
    TranslatePipe,
  ],
  templateUrl: './category-form-dialog.component.html',
})
export class CategoryFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly categoriesService = inject(ServiceCategoriesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly category = input<ServiceCategoryDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.category() !== null);

  /** True only once p-dialog's own open transition has actually finished (its
   * (onShow) event). A p-select created in the SAME tick as that transition ends
   * up with a ControlValueAccessor that doesn't register clicks - a real,
   * reproducible PrimeNG/CDK timing issue in this app's version (see
   * PriceListItemFormDialogComponent, which hit the same thing first). Only
   * rendering the form after onShow sidesteps it entirely. */
  readonly dialogShown = signal(false);

  readonly executionModeOptions = computed<ExecutionModeOption[]>(() =>
    EXECUTION_MODES.map((mode) => ({ label: this.translate.instant(executionModeTranslationKey(mode)), value: mode })),
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    executionMode: ['Individual' as ServiceExecutionMode, Validators.required],
    colorHex: [DEFAULT_COLOR_NO_HASH],
    requiresClient: [false],
    countsTowardRevenue: [false],
    description: [''],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.category());
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
    const request: ServiceCategoryUpsertRequest = {
      name: raw.name,
      executionMode: raw.executionMode,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      requiresClient: raw.requiresClient,
      countsTowardRevenue: raw.countsTowardRevenue,
      description: raw.description || null,
      sortOrder: raw.sortOrder,
    };

    const current = this.category();
    const request$ = current
      ? this.categoriesService.update(current.id, request)
      : this.categoriesService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'CATALOG.CATEGORIES.UPDATED' : 'CATALOG.CATEGORIES.CREATED'),
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

  private resetForm(category: ServiceCategoryDto | null): void {
    this.form.reset({
      name: category?.name ?? '',
      executionMode: category?.executionMode ?? 'Individual',
      colorHex: category?.colorHex ? category.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      requiresClient: category?.requiresClient ?? false,
      countsTowardRevenue: category?.countsTowardRevenue ?? false,
      description: category?.description ?? '',
      sortOrder: category?.sortOrder ?? 0,
    });
  }
}
