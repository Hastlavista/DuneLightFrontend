import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { RosterTypeDto, RosterTypeUpsertRequest } from '../../../../../core/models/roster.model';
import { RosterTypesService } from '../../../../../core/services/roster-types.service';
import { NotificationService } from '../../../../../core/services/notification.service';

const DEFAULT_COLOR_NO_HASH = '0D5C63';
const ROSTER_TYPE_COLORS = ['0D5C63', '128089', '8E3A4A', '7A5D61', '545863', 'A8DCBE'];

@Component({
  selector: 'app-roster-type-form-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, Checkbox, Button, TranslatePipe],
  templateUrl: './roster-type-form-dialog.component.html',
})
export class RosterTypeFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rosterTypesService = inject(RosterTypesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly rosterType = input<RosterTypeDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.rosterType() !== null);
  readonly colorOptions = ROSTER_TYPE_COLORS;

  /** See CategoryFormDialogComponent - only render the form once p-dialog's
   * own open transition has finished (its (onShow) event), to sidestep a
   * PrimeNG/CDK timing issue with p-colorpicker created mid-transition. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    colorHex: [DEFAULT_COLOR_NO_HASH],
    countsAsWork: [false],
    isAbsence: [false],
    requiresTime: [false],
    deductsFromLeaveFund: [false],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.rosterType());
      } else {
        this.dialogShown.set(false);
      }
    });

    // Mirrors the backend's LEAVE_FUND_TYPE_MUST_BE_ABSENCE rule - turning
    // "Odsutnost" off while "Troši fond godišnjeg" is on would otherwise send
    // an invalid combination.
    this.form.controls.isAbsence.valueChanges.subscribe((isAbsence) => {
      if (isAbsence) {
        this.form.controls.deductsFromLeaveFund.enable({ emitEvent: false });
      } else {
        this.form.controls.deductsFromLeaveFund.setValue(false, { emitEvent: false });
        this.form.controls.deductsFromLeaveFund.disable({ emitEvent: false });
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
    const request: RosterTypeUpsertRequest = {
      name: raw.name,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      countsAsWork: raw.countsAsWork,
      isAbsence: raw.isAbsence,
      requiresTime: raw.requiresTime,
      deductsFromLeaveFund: raw.deductsFromLeaveFund,
      sortOrder: raw.sortOrder,
    };

    const current = this.rosterType();
    const request$ = current
      ? this.rosterTypesService.update(current.id, request)
      : this.rosterTypesService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant(current ? 'ROSTER.TYPES.UPDATED' : 'ROSTER.TYPES.CREATED'));
        this.visible.set(false);
        this.saved.emit();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  selectColor(color: string): void {
    this.form.controls.colorHex.setValue(color);
  }

  setAbsenceMode(isAbsence: boolean): void {
    this.form.controls.isAbsence.setValue(isAbsence);
  }

  decrementSortOrder(): void {
    this.form.controls.sortOrder.setValue(this.form.controls.sortOrder.value - 1);
  }

  incrementSortOrder(): void {
    this.form.controls.sortOrder.setValue(this.form.controls.sortOrder.value + 1);
  }

  previewName(): string {
    return this.form.controls.name.value.trim() || this.translate.instant('ROSTER.TYPES.PREVIEW_FALLBACK_NAME');
  }

  previewKindLabel(): string {
    return this.translate.instant(this.form.controls.isAbsence.value ? 'ROSTER.TYPES.ABSENCE' : 'ROSTER.TYPES.PRESENCE');
  }

  previewWorkLabel(): string {
    return this.translate.instant(this.form.controls.countsAsWork.value ? 'ROSTER.TYPES.PREVIEW_COUNTS' : 'ROSTER.TYPES.PREVIEW_NOT_COUNTS');
  }

  private resetForm(type: RosterTypeDto | null): void {
    const isAbsence = type?.isAbsence ?? false;
    this.form.reset({
      name: type?.name ?? '',
      colorHex: type?.colorHex ? type.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      countsAsWork: type?.countsAsWork ?? false,
      isAbsence,
      requiresTime: type?.requiresTime ?? false,
      deductsFromLeaveFund: type?.deductsFromLeaveFund ?? false,
      sortOrder: type?.sortOrder ?? 0,
    });

    if (isAbsence) {
      this.form.controls.deductsFromLeaveFund.enable({ emitEvent: false });
    } else {
      this.form.controls.deductsFromLeaveFund.disable({ emitEvent: false });
    }
  }
}
