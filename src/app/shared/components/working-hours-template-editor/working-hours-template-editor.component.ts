import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { AppError } from '../../../core/models/api-error.model';
import { DAYS_OF_WEEK, DayOfWeek, dayOfWeekTranslationKey } from '../../../core/models/group.model';
import {
  CYCLE_TYPES,
  CycleType,
  WorkingHoursIntervalDto,
  WorkingHoursTemplateDto,
  cycleTypeTranslationKey,
  cycleWeekCount,
} from '../../../core/models/working-hours.model';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WorkingHoursTemplateService } from '../../../core/services/working-hours-template.service';
import { toStartOfDayIso } from '../../../core/utils/date.util';
import { parseTimeOfDay, toTimeOfDayString } from '../../../core/utils/time-of-day.util';
import { translationReadySignal } from '../../../core/utils/translation-signal.util';
import { HrDatePipe } from '../../pipes/hr-date.pipe';

/** Which single-owner template this instance edits - Employee XOR Company,
 * mirrors the backend's two mutually exclusive endpoints (see
 * WorkingHoursTemplateService). */
export type WorkingHoursOwner = { type: 'employee'; employeeId: string } | { type: 'company'; companyId: string };

interface SelectOption<T> {
  label: string;
  value: T;
}

/** Cross-field: end must be after start. */
function intervalRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startTime')?.value as Date | null;
  const end = group.get('endTime')?.value as Date | null;
  return start && end && end <= start ? { endBeforeStart: true } : null;
}

/** Array-level: no two intervals of the same day/week may overlap. Runs on the
 * raw time-of-day values as the user edits, rather than waiting for submit. */
function noOverlapValidator(array: AbstractControl): ValidationErrors | null {
  const ranges = (array as FormArray).controls
    .map((group) => ({ start: group.get('startTime')?.value as Date | null, end: group.get('endTime')?.value as Date | null }))
    .filter((range): range is { start: Date; end: Date } => !!range.start && !!range.end)
    .map((range) => ({
      start: range.start.getHours() * 60 + range.start.getMinutes(),
      end: range.end.getHours() * 60 + range.end.getMinutes(),
    }))
    .sort((a, b) => a.start - b.start);

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      return { overlap: true };
    }
  }
  return null;
}

/**
 * Weekly working-hours template editor (frontend #16) - one grid of day x
 * cycle-week rows, each holding zero or more start/end intervals (empty =
 * not working that day). Reused as-is for both an Employee's tab and a
 * Location's dedicated dialog, parameterized by `owner` (never duplicated per
 * screen). Self-contained: loads on every `owner` change and owns its own
 * save button - hosts just place it and optionally listen to `saved`.
 *
 * A missing template (404, e.g. a brand-new owner not yet backfilled) is
 * treated as an empty Weekly template ready to fill in, not an error.
 * `canManage` (roster.templates.manage) gates every edit affordance - a
 * roster.templates.view-only caller (the host decides whether to show this
 * component at all for such a user) still sees the grid, just without
 * add/remove/save controls. Day-specific overrides go through the existing
 * Roster module (RosterEntry), not here.
 */
@Component({
  selector: 'app-working-hours-template-editor',
  imports: [ReactiveFormsModule, Select, DatePicker, Button, TranslatePipe, HrDatePipe],
  templateUrl: './working-hours-template-editor.component.html',
  styleUrl: './working-hours-template-editor.component.scss',
})
export class WorkingHoursTemplateEditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(WorkingHoursTemplateService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly owner = input.required<WorkingHoursOwner>();

  /** Lets a wizard host (e.g. EmployeeFormComponent's "new employee" flow)
   * relabel the save button ("Spremi i nastavi") without this component
   * knowing anything about wizards - defaults to the normal standalone label. */
  readonly saveLabelKey = input<string>('COMMON.SAVE');

  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  private readonly loadedAnchorDate = signal<string | null>(null);

  readonly canManage = computed(() => this.currentEmployeeService.hasGrant('roster.templates.manage'));

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly cycleTypeOptions = computed<SelectOption<CycleType>[]>(() => {
    this.translationsReady();
    return CYCLE_TYPES.map((type) => ({ label: this.translate.instant(cycleTypeTranslationKey(type)), value: type }));
  });

  readonly dayLabels = computed<Record<DayOfWeek, string>>(() => {
    this.translationsReady();
    const labels = {} as Record<DayOfWeek, string>;
    for (const day of DAYS_OF_WEEK) {
      labels[day] = this.translate.instant(dayOfWeekTranslationKey(day));
    }
    return labels;
  });

  readonly days = DAYS_OF_WEEK;

  readonly form = this.fb.nonNullable.group({
    cycleType: this.fb.nonNullable.control<CycleType>('Weekly', Validators.required),
    weeks: this.fb.array<FormGroup>([]),
  });

  get weeksArray(): FormArray {
    return this.form.controls.weeks;
  }

  constructor() {
    effect(() => this.load(this.owner()));

    this.form.controls.cycleType.valueChanges.subscribe((type) => this.resizeWeeks(type));
  }

  weekLabel(cycleType: CycleType, weekIndex: number): string {
    this.translationsReady();
    if (cycleType === 'Weekly') {
      return '';
    }
    if (cycleType === 'Fortnightly') {
      return this.translate.instant(weekIndex === 0 ? 'WORKING_HOURS.CYCLE_WEEK.A' : 'WORKING_HOURS.CYCLE_WEEK.B');
    }
    return this.translate.instant('WORKING_HOURS.CYCLE_WEEK.N', { n: weekIndex + 1 });
  }

  anchorDateIso(): string | null {
    return this.loadedAnchorDate();
  }

  intervalsFor(weekIndex: number, day: DayOfWeek): FormArray {
    return (this.weeksArray.at(weekIndex) as FormGroup).get(day) as FormArray;
  }

  addInterval(weekIndex: number, day: DayOfWeek): void {
    this.intervalsFor(weekIndex, day).push(this.buildIntervalGroup(null, null));
  }

  removeInterval(weekIndex: number, day: DayOfWeek, index: number): void {
    this.intervalsFor(weekIndex, day).removeAt(index);
  }

  onSave(): void {
    if (!this.canManage() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const owner = this.owner();
    const request = this.toRequest();
    this.saving.set(true);
    const request$ =
      owner.type === 'employee'
        ? this.service.updateForEmployee(owner.employeeId, request)
        : this.service.updateForCompany(owner.companyId, request);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (dto) => {
        this.loadedAnchorDate.set(dto.anchorDate);
        this.notifications.showSuccess(this.translate.instant('WORKING_HOURS.SAVED'));
        this.saved.emit();
      },
      error: () => {},
    });
  }

  private load(owner: WorkingHoursOwner): void {
    this.loading.set(true);
    const request$ =
      owner.type === 'employee'
        ? this.service.getForEmployee(owner.employeeId, { suppressErrorToast: true })
        : this.service.getForCompany(owner.companyId, { suppressErrorToast: true });

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (dto) => this.applyTemplate(dto),
      error: (err: AppError) => {
        if (err.status === 404) {
          this.applyTemplate({ cycleType: 'Weekly', anchorDate: toStartOfDayIso(new Date()), intervals: [] });
        } else {
          this.notifications.showAppError(err);
        }
      },
    });
  }

  private applyTemplate(dto: WorkingHoursTemplateDto): void {
    this.loadedAnchorDate.set(dto.anchorDate);
    this.weeksArray.clear();
    for (let i = 0; i < cycleWeekCount(dto.cycleType); i++) {
      this.weeksArray.push(this.buildWeekGroup());
    }
    for (const interval of dto.intervals) {
      this.intervalsFor(interval.cycleWeekIndex, interval.dayOfWeek)?.push(
        this.buildIntervalGroup(parseTimeOfDay(interval.startTime), parseTimeOfDay(interval.endTime)),
      );
    }
    this.form.controls.cycleType.setValue(dto.cycleType, { emitEvent: false });
    this.syncEditable();
  }

  private resizeWeeks(type: CycleType): void {
    const target = cycleWeekCount(type);
    while (this.weeksArray.length < target) {
      this.weeksArray.push(this.buildWeekGroup());
    }
    while (this.weeksArray.length > target) {
      this.weeksArray.removeAt(this.weeksArray.length - 1);
    }
    this.syncEditable();
  }

  private syncEditable(): void {
    if (this.canManage()) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
  }

  private buildWeekGroup(): FormGroup {
    const controls: Record<string, FormArray> = {};
    for (const day of DAYS_OF_WEEK) {
      controls[day] = this.fb.array<FormGroup>([], noOverlapValidator);
    }
    return this.fb.group(controls);
  }

  private buildIntervalGroup(startTime: Date | null, endTime: Date | null): FormGroup {
    return this.fb.group(
      {
        startTime: this.fb.control<Date | null>(startTime, Validators.required),
        endTime: this.fb.control<Date | null>(endTime, Validators.required),
      },
      { validators: intervalRangeValidator },
    );
  }

  private toRequest(): WorkingHoursTemplateDto {
    const cycleType = this.form.controls.cycleType.value;
    const intervals: WorkingHoursIntervalDto[] = [];
    this.weeksArray.controls.forEach((weekGroup, weekIndex) => {
      for (const day of DAYS_OF_WEEK) {
        const array = (weekGroup as FormGroup).get(day) as FormArray;
        for (const intervalGroup of array.controls) {
          const raw = intervalGroup.getRawValue() as { startTime: Date; endTime: Date };
          intervals.push({
            cycleWeekIndex: weekIndex,
            dayOfWeek: day,
            startTime: toTimeOfDayString(raw.startTime),
            endTime: toTimeOfDayString(raw.endTime),
          });
        }
      }
    });
    return {
      cycleType,
      anchorDate: this.loadedAnchorDate() ?? toStartOfDayIso(new Date()),
      intervals,
    };
  }
}
