import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { finalize } from 'rxjs';
import { AppError } from '../../../core/models/api-error.model';
import {
  RECURRENCE_TYPES,
  RecurrenceType,
  RecurringConflictDetail,
  recurrenceTypeTranslationKey,
  recurringConflictReasonTranslationKey,
} from '../../../core/models/appointment.model';
import { EmployeeSummary } from '../../../core/models/employee.model';
import { LocationDto } from '../../../core/models/location.model';
import {
  RecurringScheduleBreakCreateRequest,
  ScheduleBreakCreateRequest,
} from '../../../core/models/schedule-break.model';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ScheduleBreaksService } from '../../../core/services/schedule-breaks.service';
import { toEndOfDayIso, toLocalIsoFromDate } from '../../../core/utils/date.util';
import { translationReadySignal } from '../../../core/utils/translation-signal.util';
import { NewAppointmentInitial } from '../new-appointment-dialog/new-appointment-dialog.component';

const DEFAULT_DURATION_MINUTES = 30;

const CONFLICT_DATE_FORMATTER = new Intl.DateTimeFormat('hr-HR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface SelectOption {
  label: string;
  value: string;
}

/**
 * "+ Pauza" (frontend #22) - creates a single break (POST /schedule-breaks) or
 * a recurring series (POST /schedule-breaks/recurring), reusing
 * NewAppointmentInitial for its `initial` input since both dialogs are opened
 * from the same schedule-page contexts (toolbar button or an empty-slot
 * click) with the identical startsAt/employeeId/companyId shape.
 *
 * Deliberately much smaller than NewAppointmentDialogComponent: no
 * client/service picking, no payment/billing, no availability hint - a break
 * has none of those. Trainer is locked to the logged-in employee for role
 * Member, same rule as the termin form.
 *
 * `409 APPOINTMENT_OVERLAP` is left to the default error toast, form stays
 * open - same treatment as AppointmentsService.create(). `409
 * RECURRING_CONFLICT` is rendered as a conflict-date panel, identical
 * mechanism to NewAppointmentDialogComponent's - including its new
 * `EXISTING_SCHEDULE_BREAK` reason, which only a break's own series can hit
 * as a *self*-collision but shares the reason enum with termini's series.
 */
@Component({
  selector: 'app-schedule-break-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    FormsModule,
    Select,
    DatePicker,
    InputNumber,
    Textarea,
    ToggleSwitch,
    Button,
    TranslatePipe,
  ],
  templateUrl: './schedule-break-form-dialog.component.html',
  styleUrl: './schedule-break-form-dialog.component.scss',
})
export class ScheduleBreakFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly scheduleBreaksService = inject(ScheduleBreaksService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly employees = input<EmployeeSummary[]>([]);
  readonly locations = input<LocationDto[]>([]);
  readonly initial = input<NewAppointmentInitial | null>(null);

  readonly created = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);
  readonly attemptedSubmit = signal(false);
  readonly isRecurring = signal(false);
  readonly recurringConflicts = signal<RecurringConflictDetail[] | null>(null);

  readonly recurringConflictReasonTranslationKey = recurringConflictReasonTranslationKey;

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly isMemberRole = computed(() => this.currentEmployeeService.employee()?.role === 'Member');

  readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map((employee) => ({
      label: `${employee.firstName} ${employee.lastName}`,
      value: employee.id,
    })),
  );

  readonly recurrenceTypeOptions = computed<SelectOption[]>(() => {
    this.translationsReady();
    return RECURRENCE_TYPES.map((type) => ({
      label: this.translate.instant(recurrenceTypeTranslationKey(type)),
      value: type,
    }));
  });

  readonly form = this.fb.nonNullable.group({
    employeeId: this.fb.nonNullable.control<string>('', Validators.required),
    locationId: this.fb.nonNullable.control<string>('', Validators.required),
    startsAt: this.fb.control<Date | null>(null, Validators.required),
    durationMinutes: this.fb.nonNullable.control<number>(DEFAULT_DURATION_MINUTES, [
      Validators.required,
      Validators.min(1),
    ]),
    note: this.fb.nonNullable.control<string>(''),
    recurrenceType: this.fb.control<RecurrenceType | null>(null),
    endDate: this.fb.control<Date | null>(null),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm();
      } else {
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onRecurringToggle(value: boolean): void {
    this.isRecurring.set(value);
  }

  conflictDateLabel(iso: string): string {
    return CONFLICT_DATE_FORMATTER.format(new Date(iso));
  }

  onSubmit(): void {
    this.attemptedSubmit.set(true);

    if (
      this.form.controls.employeeId.invalid ||
      this.form.controls.locationId.invalid ||
      this.form.controls.startsAt.invalid ||
      this.form.controls.durationMinutes.invalid
    ) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isRecurring()) {
      if (!this.form.controls.recurrenceType.value || !this.form.controls.endDate.value) {
        return;
      }
      this.submitRecurring();
    } else {
      this.submitCreate();
    }
  }

  private submitCreate(): void {
    const raw = this.form.getRawValue();
    const request: ScheduleBreakCreateRequest = {
      employeeId: raw.employeeId,
      companyId: raw.locationId,
      startsAt: toLocalIsoFromDate(raw.startsAt as Date),
      durationMinutes: raw.durationMinutes,
      note: raw.note || null,
    };

    this.saving.set(true);
    this.scheduleBreaksService
      .create(request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.BREAK.FORM.CREATED'));
          this.visible.set(false);
          this.created.emit();
        },
        error: () => {},
      });
  }

  private submitRecurring(): void {
    const raw = this.form.getRawValue();
    const request: RecurringScheduleBreakCreateRequest = {
      recurrenceType: raw.recurrenceType as RecurrenceType,
      employeeId: raw.employeeId,
      companyId: raw.locationId,
      firstOccurrenceStartsAt: toLocalIsoFromDate(raw.startsAt as Date),
      durationMinutes: raw.durationMinutes,
      endDate: toEndOfDayIso(raw.endDate as Date),
      note: raw.note || null,
    };

    this.recurringConflicts.set(null);
    this.saving.set(true);
    this.scheduleBreaksService
      .createRecurring(request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (results) => {
          this.notifications.showSuccess(
            this.translate.instant('SCHEDULE.BREAK.FORM.RECURRING_CREATED', {
              count: results.length,
            }),
          );
          this.visible.set(false);
          this.created.emit();
        },
        error: (err: AppError) => {
          if (err.code === 'RECURRING_CONFLICT') {
            const details = err.details as unknown as
              { conflicts?: RecurringConflictDetail[] } | undefined;
            this.recurringConflicts.set(details?.conflicts ?? []);
          } else {
            this.notifications.showAppError(err);
          }
        },
      });
  }

  private resetForm(): void {
    const init = this.initial();
    const locked = this.isMemberRole();
    const selfId = this.currentEmployeeService.employee()?.employeeId ?? '';

    this.form.reset({
      employeeId: locked ? selfId : (init?.employeeId ?? ''),
      locationId: init?.companyId ?? '',
      startsAt: init?.startsAt ?? new Date(),
      durationMinutes: DEFAULT_DURATION_MINUTES,
      note: '',
      recurrenceType: null,
      endDate: null,
    });

    if (locked) {
      this.form.controls.employeeId.disable();
    } else {
      this.form.controls.employeeId.enable();
    }

    this.isRecurring.set(false);
    this.recurringConflicts.set(null);
    this.attemptedSubmit.set(false);
  }
}
