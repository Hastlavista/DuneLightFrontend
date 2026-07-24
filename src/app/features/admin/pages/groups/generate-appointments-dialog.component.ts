import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { GroupDto } from '../../../../core/models/group.model';
import { GroupsService } from '../../../../core/services/groups.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../../core/utils/date.util';
import { translationReadySignal } from '../../../../core/utils/translation-signal.util';

interface GroupOption {
  label: string;
  value: string | null;
}

/** Group-level: "do" can't be before "od". */
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const from = group.get('fromDate')?.value as Date | null;
  const to = group.get('toDate')?.value as Date | null;
  return from && to && to < from ? { toBeforeFrom: true } : null;
}

/**
 * "Generiraj termine" - POST /api/groups/generate-appointments. Idempotent, so
 * there's no confirmation step before calling it; the result toast reports
 * created vs. skipped counts. Opened either from the groups list toolbar
 * (group left unset, defaults to "sve aktivne grupe") or from a single group's
 * row/detail page (`group` input prefills the picker, still changeable).
 */
@Component({
  selector: 'app-generate-appointments-dialog',
  imports: [Dialog, ReactiveFormsModule, Select, DatePicker, Button, TranslatePipe],
  templateUrl: './generate-appointments-dialog.component.html',
})
export class GenerateAppointmentsDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly groupsService = inject(GroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly group = input<GroupDto | null>(null);

  readonly saving = signal(false);
  readonly dialogShown = signal(false);
  readonly activeGroups = signal<GroupDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly groupOptions = computed<GroupOption[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('GROUPS.GENERATE.FIELD_GROUP_ALL_ACTIVE'), value: null },
      ...this.activeGroups().map((g) => ({ label: g.name, value: g.id })),
    ];
  });

  readonly form = this.fb.group(
    {
      groupId: this.fb.control<string | null>(null),
      fromDate: this.fb.control<Date | null>(null, Validators.required),
      toDate: this.fb.control<Date | null>(null, Validators.required),
    },
    { validators: [dateRangeValidator] },
  );

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.loadActiveGroups();
        this.form.reset({
          groupId: this.group()?.id ?? null,
          fromDate: new Date(),
          toDate: null,
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
    const fromDate = raw.fromDate as Date;
    const toDate = raw.toDate as Date;

    this.saving.set(true);
    this.groupsService
      .generateAppointments({
        groupId: raw.groupId ?? null,
        fromDate: toStartOfDayIso(fromDate),
        toDate: toEndOfDayIso(toDate),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.notifications.showSuccess(
            this.translate.instant('GROUPS.GENERATE.RESULT', {
              created: result.createdCount,
              skipped: result.skippedCount,
            }),
          );
          this.visible.set(false);
        },
        error: () => {},
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  private loadActiveGroups(): void {
    this.groupsService.getAll(true).subscribe((groups) => this.activeGroups.set(groups));
  }
}
