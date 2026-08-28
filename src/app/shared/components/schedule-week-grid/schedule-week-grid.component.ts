import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { finalize, forkJoin } from 'rxjs';
import { AppointmentScheduleCellDto, AppointmentStatus } from '../../../core/models/appointment.model';
import { BirthdayDto } from '../../../core/models/client.model';
import { CompanyHolidayDto } from '../../../core/models/company-holiday.model';
import { dayOfWeekShortTranslationKey } from '../../../core/models/group.model';
import { LocationDto } from '../../../core/models/location.model';
import { ScheduleBreakCellDto } from '../../../core/models/schedule-break.model';
import { ServiceExecutionMode } from '../../../core/models/service.model';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { ClientsService } from '../../../core/services/clients.service';
import { CompanyHolidaysService } from '../../../core/services/company-holidays.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../core/utils/date.util';
import { buildBirthdayLookup } from '../schedule-grid/schedule-birthday.util';
import { toScheduleBreakGridCell, toScheduleGridCell } from '../schedule-grid/schedule-cell-view.util';
import {
  addDays,
  dateFromLocalKey,
  dayMonthLabel,
  dayOfWeekFromDate,
  localDateKey,
  startOfWeek,
  weekRangeLabel,
} from '../schedule-grid/schedule-date.util';
import { buildHolidayLookup } from '../schedule-grid/schedule-holiday.util';
import { ScheduleGridComponent } from '../schedule-grid/schedule-grid.component';
import { ScheduleEmptySlotClickEvent, ScheduleGridCell, ScheduleGridColumn } from '../schedule-grid/schedule-grid.models';

const WEEK_COLUMN_WIDTH_PX = 140;

/** Consumed by ScheduleComponent to open NewAppointmentDialogComponent
 * prefilled with the clicked column/row - see ScheduleEmptySlotClickEvent. */
export interface WeekEmptySlotEvent {
  startsAt: Date;
  employeeId: string;
  companyId: string | null;
}

interface ScheduleFilters {
  status: AppointmentStatus | null;
  executionMode: ServiceExecutionMode | null;
  service: string | null;
  companyId: string | null;
}

/**
 * Grid B - week x days, one trainer at a time. Deliberately independent of
 * the admin section: it only needs an `employeeId` (which trainer) and the
 * usual status/service filters, so it can be dropped into the trainer app's
 * "Moj tjedan" later without changes - the trainer picker itself belongs to
 * whichever page hosts this (admin picks any trainer via a dropdown, a
 * trainer's own page will just pass their own id, no picker).
 *
 * This component owns no dialog - a click just reports the full
 * AppointmentScheduleCellDto via `appointmentClicked` and it's up to whoever
 * hosts this grid to decide what that click opens (move form for an
 * individual termin, attendance for a group one) and to call `refetch()`
 * back once that's done. Keeping that decision out of this component is
 * what lets it stay admin-agnostic - see ScheduleComponent for the admin
 * wiring of both halves.
 */
@Component({
  selector: 'app-schedule-week-grid',
  imports: [ScheduleGridComponent, Button, TranslatePipe],
  templateUrl: './schedule-week-grid.component.html',
  styleUrl: './schedule-week-grid.component.scss',
})
export class ScheduleWeekGridComponent {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly clientsService = inject(ClientsService);
  private readonly companyHolidaysService = inject(CompanyHolidaysService);
  private readonly locationContext = inject(LocationContextService);
  private readonly translate = inject(TranslateService);

  readonly employeeId = input<string | null>(null);
  readonly statusFilter = input<AppointmentStatus | null>(null);
  readonly executionModeFilter = input<ServiceExecutionMode | null>(null);
  readonly serviceFilter = input<string | null>(null);
  /** Fetched once by ScheduleComponent and shared with both grids - see
   * MyShiftsComponent for the same "fetch once, pass down via @Input" pattern
   * applied to Roster's team/personal tabs. */
  readonly activeLocations = input<LocationDto[]>([]);

  readonly emptySlotClick = output<WeekEmptySlotEvent>();
  readonly appointmentClicked = output<AppointmentScheduleCellDto>();
  readonly breakClicked = output<ScheduleBreakCellDto>();

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly loading = signal(false);
  private readonly rawCells = signal<AppointmentScheduleCellDto[]>([]);
  private readonly rawBreaks = signal<ScheduleBreakCellDto[]>([]);
  private readonly rawBirthdays = signal<BirthdayDto[]>([]);
  private readonly birthdayLookup = computed(() => buildBirthdayLookup(this.rawBirthdays()));
  private readonly locationColors = computed<Map<string, string | null>>(
    () => new Map(this.activeLocations().map((location) => [location.id, location.colorHex])),
  );

  /** "Sve lokacije" (null) skips holiday marking entirely - there's no single
   * company to check, and blending several locations' holidays into one
   * column would misrepresent which one the day is actually closed for. */
  private readonly rawHolidays = signal<CompanyHolidayDto[]>([]);
  private readonly holidayLookup = computed(() => buildHolidayLookup(this.rawHolidays()));

  readonly columnWidthPx = WEEK_COLUMN_WIDTH_PX;
  readonly rangeLabel = computed(() => weekRangeLabel(this.weekStart()));

  readonly columns = computed<ScheduleGridColumn[]>(() => {
    const start = this.weekStart();
    const holidays = this.holidayLookup();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const dateKey = localDateKey(date);
      const holidayName = holidays.get(dateKey);
      return {
        id: dateKey,
        label: this.translate.instant(dayOfWeekShortTranslationKey(dayOfWeekFromDate(date))),
        subLabel: dayMonthLabel(date),
        isHoliday: holidayName !== undefined,
        holidayName,
      };
    });
  });

  /** Cancelled termini free their slot and never render on the grid - a
   * cancelled slot looks like plain empty space, clickable like any other
   * empty cell to book a new termin. NoShow keeps rendering (dimmed/
   * struck-through, see toScheduleGridCell) since that status stays visible
   * by design. */
  readonly gridCells = computed<ScheduleGridCell[]>(() => {
    const showLocationBadge = this.locationContext.selectedLocationId() === null;
    const colors = this.locationColors();
    const birthdays = this.birthdayLookup();
    const appointmentCells = this.rawCells()
      .filter((dto) => dto.status !== 'Cancelled')
      .map((dto) =>
        toScheduleGridCell(
          dto,
          localDateKey(new Date(dto.startsAt)),
          showLocationBadge ? (colors.get(dto.companyId) ?? null) : null,
          this.translate,
          birthdays,
        ),
      );
    const breakCells = this.rawBreaks().map((dto) =>
      toScheduleBreakGridCell(
        dto,
        localDateKey(new Date(dto.startsAt)),
        showLocationBadge ? (colors.get(dto.companyId) ?? null) : null,
        this.translate,
      ),
    );
    return [...appointmentCells, ...breakCells];
  });

  constructor() {
    effect(() => {
      const employeeId = this.employeeId();
      const weekStart = this.weekStart();
      const filters: ScheduleFilters = {
        status: this.statusFilter(),
        executionMode: this.executionModeFilter(),
        service: this.serviceFilter(),
        companyId: this.locationContext.selectedLocationId(),
      };

      if (!employeeId) {
        this.rawCells.set([]);
        this.rawBreaks.set([]);
        this.rawBirthdays.set([]);
        return;
      }
      this.fetch(employeeId, weekStart, filters);
    });

    // Independent of employeeId - the holiday markers only depend on the
    // visible week and the globally-selected location, fetched once per
    // change rather than on every render (see class doc on rawHolidays).
    effect(() => this.fetchHolidays(this.locationContext.selectedLocationId(), this.weekStart()));
  }

  goPrevWeek(): void {
    this.weekStart.update((date) => addDays(date, -7));
  }

  goNextWeek(): void {
    this.weekStart.update((date) => addDays(date, 7));
  }

  goToday(): void {
    this.weekStart.set(startOfWeek(new Date()));
  }

  onCellClick(cell: ScheduleGridCell): void {
    if (cell.kind === 'break') {
      this.breakClicked.emit(cell.source as ScheduleBreakCellDto);
    } else {
      this.appointmentClicked.emit(cell.source as AppointmentScheduleCellDto);
    }
  }

  onEmptySlotClick(event: ScheduleEmptySlotClickEvent): void {
    const employeeId = this.employeeId();
    if (!employeeId) {
      return;
    }
    const date = dateFromLocalKey(event.columnId);
    date.setHours(Math.floor(event.startMinutes / 60), event.startMinutes % 60, 0, 0);
    this.emptySlotClick.emit({ startsAt: date, employeeId, companyId: this.locationContext.selectedLocationId() });
  }

  /** Public so ScheduleComponent can trigger a reload after closing whichever
   * dialog it opened for a cell click - this component doesn't need to know
   * why, only that its data may be stale. */
  refetch(): void {
    const employeeId = this.employeeId();
    if (!employeeId) {
      return;
    }
    this.fetch(employeeId, this.weekStart(), {
      status: this.statusFilter(),
      executionMode: this.executionModeFilter(),
      service: this.serviceFilter(),
      companyId: this.locationContext.selectedLocationId(),
    });
  }

  private fetch(employeeId: string, weekStart: Date, filters: ScheduleFilters): void {
    this.loading.set(true);
    const from = toStartOfDayIso(weekStart);
    const to = toEndOfDayIso(addDays(weekStart, 6));
    forkJoin({
      feed: this.appointmentsService.getSchedule({
        from,
        to,
        employeeId,
        companyId: filters.companyId ?? undefined,
        status: filters.status ?? undefined,
        executionMode: filters.executionMode ?? undefined,
        serviceId: filters.service ?? undefined,
      }),
      birthdays: this.clientsService.getBirthdays(from, to),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ feed, birthdays }) => {
        this.rawCells.set(feed.appointments);
        this.rawBreaks.set(feed.breaks);
        this.rawBirthdays.set(birthdays);
      });
  }

  /** A week can span two calendar years (e.g. 29.12. - 4.1.) - fetch both
   * years in that rare case rather than assuming one. */
  private fetchHolidays(companyId: string | null, weekStart: Date): void {
    if (!companyId) {
      this.rawHolidays.set([]);
      return;
    }
    const years = new Set([weekStart.getFullYear(), addDays(weekStart, 6).getFullYear()]);
    forkJoin(Array.from(years).map((year) => this.companyHolidaysService.getForYear(companyId, year))).subscribe(
      (results) => this.rawHolidays.set(results.flat()),
    );
  }
}
