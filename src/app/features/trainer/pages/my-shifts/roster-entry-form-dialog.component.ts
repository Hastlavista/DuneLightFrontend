import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { EmployeeSummary } from '../../../../core/models/employee.model';
import { RosterEntryDto, RosterEntryUpsertRequest, RosterTypeDto } from '../../../../core/models/roster.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RosterEntriesService } from '../../../../core/services/roster-entries.service';
import { toStartOfDayIso } from '../../../../core/utils/date.util';
import { parseTimeOfDay, toTimeOfDayString } from '../../../../core/utils/time-of-day.util';

interface SelectOption {
  label: string;
  value: string;
}

/** Prefill for a new entry, resolved by the caller before opening - either a
 * team-monthly matrix cell click (own row for Member, any row for Admin) or a
 * personal view's "+" button (always the current employee, today). */
export interface RosterEntryFormInitial {
  employeeId?: string | null;
  date?: Date | null;
}

/**
 * Ekran 4 - novi/uredi zapis rostera. One DTO, shape decided by the chosen
 * RosterType's `isAbsence`: rad wants a single day + start/end time, odsutnost
 * wants a date range (dateTo optional = still open) + no time. Switching the
 * type dropdown clears whichever fields don't apply to the new shape.
 *
 * Zaposlenik is locked to the current employee for any non-Admin role
 * (Member, Reception), and also locked in edit mode for everyone - the
 * backend only explicitly forbids Member from reassigning employeeId, but
 * there's no legitimate reason for anyone to reassign an existing entry to
 * someone else, so the UI doesn't offer it at all. When locked, the field
 * renders as plain static text rather than a disabled p-select: a disabled
 * select has no reason to carry a matching option (the `employees` lookup is
 * an ACTIVE-only, Admin-oriented list - a non-Admin viewer's own record, or
 * an edited entry's now-inactive owner, may simply not be in it), so a
 * disabled-select rendering would show a broken-looking blank control instead
 * of the name. Static text sidesteps that entirely.
 *
 * A two-shift work day is two separate entries, never one entry with two
 * ranges (see RosterEntryDto) - after saving a new work entry, offer a quick
 * "add another for the same day" follow-up instead of trying to model it as
 * one row.
 */
@Component({
  selector: 'app-roster-entry-form-dialog',
  imports: [Dialog, ReactiveFormsModule, Select, DatePicker, Textarea, Button, TranslatePipe],
  templateUrl: './roster-entry-form-dialog.component.html',
})
export class RosterEntryFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rosterEntriesService = inject(RosterEntriesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly entry = input<RosterEntryDto | null>(null);
  readonly initial = input<RosterEntryFormInitial | null>(null);
  readonly employees = input<EmployeeSummary[]>([]);
  readonly rosterTypes = input<RosterTypeDto[]>([]);
  /** True only for the real 'Admin' role - every other role (Member,
   * Reception) gets the locked/static employee field, see this component's
   * doc comment. */
  readonly isAdminRole = input.required<boolean>();
  readonly currentEmployeeId = input<string | null>(null);

  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);
  readonly localError = signal<string | null>(null);

  readonly isEditMode = computed(() => this.entry() !== null);
  readonly employeeLocked = computed(() => !this.isAdminRole() || this.isEditMode());

  /** Display name for the locked/static employee field - the edited entry's
   * own name in edit mode (accurate even if that employee is no longer
   * active/in `employees()`), otherwise the logged-in user's own name. */
  readonly lockedEmployeeName = computed(() => {
    const entry = this.entry();
    if (entry) {
      return entry.employeeName;
    }
    const current = this.currentEmployeeService.employee();
    return current ? `${current.firstName} ${current.lastName}` : '';
  });

  readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map((employee) => ({ label: `${employee.firstName} ${employee.lastName}`, value: employee.id })),
  );

  readonly rosterTypeOptions = computed<SelectOption[]>(() =>
    this.rosterTypes().map((type) => ({ label: type.name, value: type.id })),
  );

  readonly form = this.fb.nonNullable.group({
    employeeId: this.fb.nonNullable.control<string>('', Validators.required),
    rosterTypeId: this.fb.nonNullable.control<string>('', Validators.required),
    dateFrom: this.fb.control<Date | null>(null, Validators.required),
    dateTo: this.fb.control<Date | null>(null),
    startTime: this.fb.control<Date | null>(null),
    endTime: this.fb.control<Date | null>(null),
    note: this.fb.nonNullable.control<string>(''),
  });

  /** Tracks the type dropdown's own value as a signal (not just the FormControl)
   * so the template can reactively branch the field layout on it. */
  private readonly selectedTypeId = signal<string>('');

  readonly selectedType = computed<RosterTypeDto | null>(
    () => this.rosterTypes().find((type) => type.id === this.selectedTypeId()) ?? null,
  );

  readonly isAbsenceShape = computed(() => this.selectedType()?.isAbsence ?? false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.entry(), this.initial());
      } else {
        this.dialogShown.set(false);
      }
    });

    this.form.controls.rosterTypeId.valueChanges.subscribe((typeId) => {
      this.selectedTypeId.set(typeId);
      this.localError.set(null);
      // Clear whatever the previous shape's fields held - a leftover
      // startTime/dateTo from before the switch must never be sent.
      this.form.patchValue({ dateTo: null, startTime: null, endTime: null }, { emitEvent: false });
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSave(): void {
    this.localError.set(null);

    if (this.form.controls.employeeId.invalid || this.form.controls.rosterTypeId.invalid || this.form.controls.dateFrom.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const type = this.selectedType();
    if (!type) {
      return;
    }

    const raw = this.form.getRawValue();
    const dateFrom = raw.dateFrom as Date;
    let request: RosterEntryUpsertRequest;

    if (type.isAbsence) {
      const dateTo = raw.dateTo;
      if (dateTo && dateTo < dateFrom) {
        this.localError.set(this.translate.instant('ROSTER.ENTRY_FORM.ERRORS.DATE_TO_BEFORE_FROM'));
        return;
      }
      request = {
        employeeId: raw.employeeId,
        rosterTypeId: raw.rosterTypeId,
        dateFrom: toStartOfDayIso(dateFrom),
        dateTo: dateTo ? toStartOfDayIso(dateTo) : null,
        startTime: null,
        endTime: null,
        note: raw.note || null,
      };
    } else {
      const startTime = raw.startTime;
      const endTime = raw.endTime;
      if (!startTime || !endTime) {
        this.form.controls.startTime.markAsTouched();
        this.form.controls.endTime.markAsTouched();
        this.localError.set(this.translate.instant('ROSTER.ENTRY_FORM.ERRORS.TIME_REQUIRED'));
        return;
      }
      if (endTime <= startTime) {
        this.localError.set(this.translate.instant('ROSTER.ENTRY_FORM.ERRORS.END_BEFORE_START'));
        return;
      }
      request = {
        employeeId: raw.employeeId,
        rosterTypeId: raw.rosterTypeId,
        dateFrom: toStartOfDayIso(dateFrom),
        dateTo: null,
        startTime: toTimeOfDayString(startTime),
        endTime: toTimeOfDayString(endTime),
        note: raw.note || null,
      };
    }

    const current = this.entry();
    const request$ = current
      ? this.rosterEntriesService.update(current.id, request)
      : this.rosterEntriesService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (result) => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'ROSTER.ENTRY_FORM.UPDATED' : 'ROSTER.ENTRY_FORM.CREATED'),
        );
        result.warnings.forEach((warning) => this.notifications.showWarning(warning));
        this.saved.emit();

        if (!current && !type.isAbsence) {
          this.offerAddAnother(request.employeeId, dateFrom);
        } else {
          this.visible.set(false);
        }
      },
      error: () => {},
    });
  }

  private offerAddAnother(employeeId: string, date: Date): void {
    this.confirmationService.confirm({
      header: this.translate.instant('ROSTER.ENTRY_FORM.ADD_ANOTHER_HEADER'),
      message: this.translate.instant('ROSTER.ENTRY_FORM.ADD_ANOTHER_MESSAGE'),
      icon: 'pi pi-plus',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.form.patchValue({
          employeeId,
          rosterTypeId: '',
          dateFrom: date,
          dateTo: null,
          startTime: null,
          endTime: null,
          note: '',
        });
        this.selectedTypeId.set('');
        this.form.markAsUntouched();
        this.localError.set(null);
      },
      reject: () => {
        this.visible.set(false);
      },
    });
  }

  private resetForm(entry: RosterEntryDto | null, initial: RosterEntryFormInitial | null): void {
    const locked = !this.isAdminRole() || entry !== null;
    const selfId = this.currentEmployeeId() ?? '';

    if (entry) {
      this.form.reset({
        employeeId: entry.employeeId,
        rosterTypeId: entry.rosterTypeId,
        dateFrom: new Date(entry.dateFrom),
        dateTo: entry.dateTo ? new Date(entry.dateTo) : null,
        startTime: entry.startTime ? parseTimeOfDay(entry.startTime) : null,
        endTime: entry.endTime ? parseTimeOfDay(entry.endTime) : null,
        note: entry.note ?? '',
      });
      this.selectedTypeId.set(entry.rosterTypeId);
    } else {
      this.form.reset({
        employeeId: !this.isAdminRole() ? selfId : (initial?.employeeId ?? ''),
        rosterTypeId: '',
        dateFrom: initial?.date ?? new Date(),
        dateTo: null,
        startTime: null,
        endTime: null,
        note: '',
      });
      this.selectedTypeId.set('');
    }

    if (locked) {
      this.form.controls.employeeId.disable();
    } else {
      this.form.controls.employeeId.enable();
    }

    this.localError.set(null);
  }
}
