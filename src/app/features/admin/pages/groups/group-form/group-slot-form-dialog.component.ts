import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { DAYS_OF_WEEK, DayOfWeek, GroupSlotDto, dayOfWeekTranslationKey } from '../../../../../core/models/group.model';
import { GroupsService } from '../../../../../core/services/groups.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { parseTimeOfDay, toTimeOfDayString } from '../../../../../core/utils/time-of-day.util';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';

interface DayOption {
  label: string;
  value: DayOfWeek;
}

/** Add/edit a single slot - POST/PUT .../slots(/{slotId}), each returning the
 * whole GroupDto (see GroupsService). The parent section refetches the full
 * group detail on `saved` rather than trying to reconcile that partial
 * response itself. */
@Component({
  selector: 'app-group-slot-form-dialog',
  imports: [Dialog, ReactiveFormsModule, Select, DatePicker, Button, TranslatePipe],
  templateUrl: './group-slot-form-dialog.component.html',
})
export class GroupSlotFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly groupsService = inject(GroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly groupId = input.required<string>();
  readonly slot = input<GroupSlotDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);
  readonly isEditMode = signal(false);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly dayOptions = computed<DayOption[]>(() => {
    this.translationsReady();
    return DAYS_OF_WEEK.map((day) => ({ label: this.translate.instant(dayOfWeekTranslationKey(day)), value: day }));
  });

  readonly form = this.fb.nonNullable.group({
    dayOfWeek: this.fb.nonNullable.control<DayOfWeek>('Monday', Validators.required),
    startTime: this.fb.control<Date | null>(null, Validators.required),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        const slot = this.slot();
        this.isEditMode.set(slot !== null);
        this.form.reset({
          dayOfWeek: slot?.dayOfWeek ?? 'Monday',
          startTime: slot ? parseTimeOfDay(slot.startTime) : null,
        });
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
    const request = { dayOfWeek: raw.dayOfWeek, startTime: toTimeOfDayString(raw.startTime as Date) };
    const slot = this.slot();

    this.saving.set(true);
    const request$ = slot
      ? this.groupsService.updateSlot(this.groupId(), slot.id, request)
      : this.groupsService.addSlot(this.groupId(), request);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant(slot ? 'GROUPS.SLOTS.UPDATED' : 'GROUPS.SLOTS.ADDED'));
        this.visible.set(false);
        this.saved.emit();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
