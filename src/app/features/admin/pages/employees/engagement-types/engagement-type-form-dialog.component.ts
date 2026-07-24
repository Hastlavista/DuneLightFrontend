import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { EngagementTypeDto, EngagementTypeUpsertRequest } from '../../../../../core/models/engagement-type.model';
import { EngagementTypesService } from '../../../../../core/services/engagement-types.service';
import { NotificationService } from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-engagement-type-form-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, InputNumber, Button, TranslatePipe],
  templateUrl: './engagement-type-form-dialog.component.html',
})
export class EngagementTypeFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly engagementTypesService = inject(EngagementTypesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly engagementType = input<EngagementTypeDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.engagementType() !== null);

  /** See CategoryFormDialogComponent - only render the form once p-dialog's own
   * open transition has finished, to sidestep a PrimeNG/CDK timing issue. Not
   * strictly needed here (no p-select in this form) but kept for consistency
   * with the other šifrarnik dialogs in this app. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.engagementType());
      } else {
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
    const request: EngagementTypeUpsertRequest = {
      name: raw.name,
      sortOrder: raw.sortOrder,
    };

    const current = this.engagementType();
    const request$ = current
      ? this.engagementTypesService.update(current.id, request)
      : this.engagementTypesService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'EMPLOYEES.ENGAGEMENT_TYPES.UPDATED' : 'EMPLOYEES.ENGAGEMENT_TYPES.CREATED'),
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

  private resetForm(type: EngagementTypeDto | null): void {
    this.form.reset({
      name: type?.name ?? '',
      sortOrder: type?.sortOrder ?? 0,
    });
  }
}
