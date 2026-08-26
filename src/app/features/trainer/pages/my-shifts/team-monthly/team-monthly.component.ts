import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { LocationDto } from '../../../../../core/models/location.model';
import {
  RosterDayEntryDto,
  RosterDaySource,
  RosterPlannedIntervalDto,
  TeamMonthlyEmployeeDto,
} from '../../../../../core/models/roster.model';
import { RosterEntriesService } from '../../../../../core/services/roster-entries.service';
import {
  YearMonth,
  addMonths,
  currentYearMonth,
  dateForDay,
  daysInMonth,
  isCurrentMonth,
  monthYearLabel,
  todayDayOfMonth,
} from '../roster-month.util';

interface LocationOption {
  label: string;
  value: string | null;
}

/** Emitted for every cell click on a row the current user may edit (own row
 * for Member, any row for Admin) - clicks on a non-editable row are simply
 * ignored by this component, per the "Member vidi sve, uređuje samo svoje"
 * transparency rule. `entryId` is null for an empty cell (or a click that
 * missed every entry badge) - the parent opens the form in create mode with
 * employeeId+date prefilled; a non-null id means the parent should fetch that
 * RosterEntryDto and open the form in edit mode (this grid's own
 * TeamMonthlyDto only carries a thin per-day projection, not the full entry). */
export interface TeamMonthlyCellClickEvent {
  employeeId: string;
  employeeName: string;
  date: Date;
  entryId: string | null;
  /** Set only for a click on a `Planned` badge (see plannedIntervals()) - the
   * parent prefills the create form's time fields from it so a cell that
   * already visibly shows a time range doesn't open as a fully blank form.
   * There's no rosterTypeId here (a WorkingHoursTemplate projection isn't
   * tied to any specific RosterType), so the type dropdown still starts
   * unselected either way. */
  plannedInterval: RosterPlannedIntervalDto | null;
}

/**
 * Ekran 2 - employees (retci) x dani mjeseca (stupci). Self-contained: owns
 * its own month navigation and location filter, fetches
 * GET /roster/team-monthly directly (same "dumb grid vs. self-fetching
 * component" spectrum as ScheduleWeekGridComponent - this one is closer to
 * self-fetching since there's no absolute-positioned time axis to keep
 * generic). The matrix itself is already fully assembled server-side
 * (TeamMonthlyDto) - never re-aggregate `workHoursByType`/`totalWorkHours`/
 * `absenceDaysByType` here.
 */
@Component({
  selector: 'app-roster-team-monthly',
  imports: [Button, Select, FormsModule, TranslatePipe],
  templateUrl: './team-monthly.component.html',
  styleUrl: './team-monthly.component.scss',
})
export class TeamMonthlyComponent {
  private readonly rosterEntriesService = inject(RosterEntriesService);
  private readonly translate = inject(TranslateService);

  readonly currentEmployeeId = input<string | null>(null);
  readonly isAdmin = input.required<boolean>();
  readonly activeLocations = input<LocationDto[]>([]);

  readonly cellClick = output<TeamMonthlyCellClickEvent>();

  readonly yearMonth = signal<YearMonth>(currentYearMonth());
  readonly locationId = signal<string | null>(null);
  readonly employees = signal<TeamMonthlyEmployeeDto[]>([]);
  readonly loading = signal(false);

  readonly monthLabel = computed(() => monthYearLabel(this.yearMonth()));
  readonly isThisMonth = computed(() => isCurrentMonth(this.yearMonth()));
  readonly todayDay = computed(() => (this.isThisMonth() ? todayDayOfMonth() : null));
  readonly days = computed<number[]>(() =>
    Array.from({ length: daysInMonth(this.yearMonth().year, this.yearMonth().month) }, (_, i) => i + 1),
  );

  readonly locationOptions = computed<LocationOption[]>(() => [
    { label: this.translate.instant('ROSTER.TEAM_MONTHLY.ALL_LOCATIONS'), value: null },
    ...this.activeLocations().map((location) => ({ label: location.name, value: location.id })),
  ]);

  constructor() {
    this.fetch();
  }

  prevMonth(): void {
    this.yearMonth.set(addMonths(this.yearMonth(), -1));
    this.fetch();
  }

  nextMonth(): void {
    this.yearMonth.set(addMonths(this.yearMonth(), 1));
    this.fetch();
  }

  goToday(): void {
    this.yearMonth.set(currentYearMonth());
    this.fetch();
  }

  onLocationChange(value: string | null): void {
    this.locationId.set(value);
    this.fetch();
  }

  refetch(): void {
    this.fetch();
  }

  isRowEditable(employeeId: string): boolean {
    return this.isAdmin() || employeeId === this.currentEmployeeId();
  }

  dayEntries(employee: TeamMonthlyEmployeeDto, day: number): RosterDayEntryDto[] {
    return employee.days[day - 1]?.entries ?? [];
  }

  entryLabel(entry: RosterDayEntryDto): string {
    if (entry.isAbsence) {
      return entry.rosterTypeName;
    }
    return entry.hours != null ? `${entry.rosterTypeName} ${entry.hours}h` : entry.rosterTypeName;
  }

  entryTooltip(entry: RosterDayEntryDto): string {
    return entry.timeRange ? `${entry.rosterTypeName} ${entry.timeRange}` : entry.rosterTypeName;
  }

  /** `Actual`/`None` render exactly as before (real entries or nothing).
   * `Assumed` and `Planned` both project from plannedIntervals() - `Assumed`
   * renders identical to `Actual` (no dashed/muted styling, no "Planirano"
   * wording - see the template), `Planned` keeps the muted/dashed style,
   * since only `Planned` days genuinely haven't happened yet (frontend #28). */
  daySource(employee: TeamMonthlyEmployeeDto, day: number): RosterDaySource {
    return employee.days[day - 1]?.source ?? 'None';
  }

  plannedIntervals(employee: TeamMonthlyEmployeeDto, day: number): RosterPlannedIntervalDto[] {
    return employee.days[day - 1]?.plannedIntervals ?? [];
  }

  plannedLabel(interval: RosterPlannedIntervalDto): string {
    return `${interval.start.slice(0, 5)}–${interval.end.slice(0, 5)}`;
  }

  plannedTooltip(interval: RosterPlannedIntervalDto): string {
    return `${this.translate.instant('ROSTER.PLANNED_LABEL')}: ${this.plannedLabel(interval)}`;
  }

  /** No "Planirano" wording here on purpose (frontend #28) - an `Assumed` cell
   * must look and read exactly like a real record, the tooltip included. */
  assumedTooltip(interval: RosterPlannedIntervalDto): string {
    return this.plannedLabel(interval);
  }

  onCellClick(
    employee: TeamMonthlyEmployeeDto,
    day: number,
    entryId: string | null,
    plannedInterval: RosterPlannedIntervalDto | null = null,
  ): void {
    if (!this.isRowEditable(employee.employeeId)) {
      return;
    }
    this.cellClick.emit({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      date: dateForDay(this.yearMonth(), day),
      entryId,
      plannedInterval,
    });
  }

  rowSummaryTooltip(employee: TeamMonthlyEmployeeDto): string {
    const lines: string[] = [];
    for (const item of employee.workHoursByType) {
      lines.push(`${item.rosterTypeName}: ${item.hours}h`);
    }
    if (employee.absenceDaysByType.length > 0) {
      if (lines.length > 0) {
        lines.push('');
      }
      lines.push(this.translate.instant('ROSTER.TEAM_MONTHLY.ABSENCES_TOOLTIP_HEADER'));
      for (const item of employee.absenceDaysByType) {
        lines.push(`${item.rosterTypeName}: ${item.days}`);
      }
    }
    return lines.join('\n');
  }

  private fetch(): void {
    this.loading.set(true);
    this.rosterEntriesService
      .teamMonthly({ year: this.yearMonth().year, month: this.yearMonth().month, companyId: this.locationId() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => this.employees.set(result.employees));
  }
}
