import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Observable, catchError, finalize, forkJoin, of } from 'rxjs';
import { AppointmentScheduleCellDto, AppointmentStatus } from '../../../../../core/models/appointment.model';
import { BirthdayDto } from '../../../../../core/models/client.model';
import { CompanyHolidayDto } from '../../../../../core/models/company-holiday.model';
import { EmployeeColumnEntry } from '../../../../../core/models/employee.model';
import { StudioCompany } from '../../../../../core/models/company.model';
import { ScheduleBreakCellDto } from '../../../../../core/models/schedule-break.model';
import { ServiceExecutionMode } from '../../../../../core/models/service.model';
import { AppointmentsService } from '../../../../../core/services/appointments.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { CompanyHolidaysService } from '../../../../../core/services/company-holidays.service';
import { CompanyContextService } from '../../../../../core/services/company-context.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../../../core/utils/date.util';
import { buildBirthdayLookup } from '../../../../../shared/components/schedule-grid/schedule-birthday.util';
import { toScheduleBreakGridCell, toScheduleGridCell } from '../../../../../shared/components/schedule-grid/schedule-cell-view.util';
import { localDateKey, startOfDay } from '../../../../../shared/components/schedule-grid/schedule-date.util';
import { buildHolidayLookup } from '../../../../../shared/components/schedule-grid/schedule-holiday.util';
import { ScheduleGridComponent } from '../../../../../shared/components/schedule-grid/schedule-grid.component';
import {
  ScheduleEmptySlotClickEvent,
  ScheduleGridCell,
  ScheduleGridColumn,
} from '../../../../../shared/components/schedule-grid/schedule-grid.models';

const DAY_COLUMN_WIDTH_PX = 220;

/** Consumed by ScheduleComponent to open NewAppointmentDialogComponent
 * prefilled with the clicked column/row - see ScheduleEmptySlotClickEvent. */
export interface DayEmptySlotEvent {
  startsAt: Date;
  employeeId: string;
  companyId: string | null;
}

interface ScheduleFilters {
  status: AppointmentStatus | null;
  executionMode: ServiceExecutionMode | null;
  service: string | null;
  companyId: string | null;
  roomId: string | null;
}

/**
 * Grid A - one day x every trainer, the admin "Raspored" default view.
 * Trainer columns are the active employees, narrowed to whichever ones are
 * assigned to the globally-selected company (CompanyContextService) - "sve
 * lokacije" shows every active trainer, since the same trainer can work both
 * companies. Company itself is NOT a column split - a trainer's appointments
 * from either company land in the same column, distinguished only by the
 * small company-colored dot on the block (see toScheduleGridCell).
 *
 * This component only positions/fetches cells and reports clicks via
 * `appointmentClicked` - it deliberately owns no dialog (neither the
 * individual move form nor the group attendance one), so it stays admin-
 * agnostic and reusable as-is. ScheduleComponent (its admin host) decides
 * which dialog a click opens and calls `refetch()` back on this component
 * once that dialog is done, via a template reference - see
 * ScheduleComponent for both halves of that wiring.
 */
@Component({
  selector: 'app-admin-schedule-day-grid',
  imports: [ScheduleGridComponent, Button, DatePicker, FormsModule, TranslatePipe],
  templateUrl: './schedule-day-grid.component.html',
  styleUrl: './schedule-day-grid.component.scss',
})
export class ScheduleDayGridComponent {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly clientsService = inject(ClientsService);
  private readonly companyHolidaysService = inject(CompanyHolidaysService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private scheduleRequestToken = 0;
  private holidaysRequestToken = 0;
  private readonly translate = inject(TranslateService);

  readonly employees = input.required<EmployeeColumnEntry[]>();
  readonly statusFilter = input<AppointmentStatus | null>(null);
  readonly executionModeFilter = input<ServiceExecutionMode | null>(null);
  readonly serviceFilter = input<string | null>(null);
  readonly roomFilter = input<string | null>(null);
  /** Fetched once by ScheduleComponent and shared with both grids - see
   * MyShiftsComponent for the same "fetch once, pass down via @Input" pattern
   * applied to Roster's team/personal tabs. */
  readonly activeCompanies = input<StudioCompany[]>([]);

  readonly emptySlotClick = output<DayEmptySlotEvent>();
  readonly appointmentClicked = output<AppointmentScheduleCellDto>();
  readonly breakClicked = output<ScheduleBreakCellDto>();

  readonly selectedDate = signal(startOfDay(new Date()));
  readonly loading = signal(false);
  private readonly rawCells = signal<AppointmentScheduleCellDto[]>([]);
  private readonly rawBreaks = signal<ScheduleBreakCellDto[]>([]);
  private readonly rawBirthdays = signal<BirthdayDto[]>([]);
  private readonly birthdayLookup = computed(() => buildBirthdayLookup(this.rawBirthdays()));
  private readonly companyColors = computed<Map<string, string | null>>(
    () => new Map(this.activeCompanies().map((company) => [company.id, company.colorHex])),
  );

  /** "Sve lokacije" (null) skips the banner entirely - same reasoning as
   * ScheduleWeekGridComponent's rawHolidays doc. Columns here are trainers,
   * not days, so a holiday can't be a per-column highlight - see
   * ScheduleGridColumn.isHoliday's doc. */
  private readonly rawHolidays = signal<CompanyHolidayDto[]>([]);
  private readonly holidayLookup = computed(() => buildHolidayLookup(this.rawHolidays()));
  readonly todayHolidayName = computed(() => this.holidayLookup().get(localDateKey(this.selectedDate())) ?? null);
  readonly selectedDateLabel = computed(() =>
    new Intl.DateTimeFormat('hr-HR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.selectedDate()),
  );

  readonly columnWidthPx = DAY_COLUMN_WIDTH_PX;

  readonly columns = computed<ScheduleGridColumn[]>(() => {
    const companyName = this.companyContext.selectedCompany()?.name ?? null;
    return this.employees()
      .filter((employee) => !companyName || employee.companyNames.includes(companyName))
      .map((employee) => ({ id: employee.id, label: `${employee.firstName} ${employee.lastName}` }));
  });

  /** Cancelled termini free their slot and never render on the grid - a
   * cancelled slot looks like plain empty space, clickable like any other
   * empty cell to book a new termin. There is no appointment-level NoShow to
   * filter (see AppointmentStatus's doc - only a per-client Booking can be
   * NoShow, and the lightweight schedule feed doesn't carry that yet). */
  readonly gridCells = computed<ScheduleGridCell[]>(() => {
    const showCompanyBadge = this.companyContext.selectedCompanyId() === null;
    const colors = this.companyColors();
    const birthdays = this.birthdayLookup();
    const appointmentCells = this.rawCells()
      .filter((dto) => dto.status !== 'Cancelled')
      .map((dto) =>
        toScheduleGridCell(
          dto,
          dto.employeeId,
          showCompanyBadge ? (colors.get(dto.companyId) ?? null) : null,
          this.translate,
          birthdays,
        ),
      );
    const breakCells = this.rawBreaks().map((dto) =>
      toScheduleBreakGridCell(
        dto,
        dto.employeeId,
        showCompanyBadge ? (colors.get(dto.companyId) ?? null) : null,
        this.translate,
      ),
    );
    return [...appointmentCells, ...breakCells];
  });

  constructor() {
    effect(() => {
      const date = this.selectedDate();
      const filters: ScheduleFilters = {
        status: this.statusFilter(),
        executionMode: this.executionModeFilter(),
        service: this.serviceFilter(),
        companyId: this.companyContext.selectedCompanyId(),
        roomId: this.roomFilter(),
      };
      this.fetch(date, filters);
    });

    // Independent of the trainer columns - only depends on the shown day and
    // the globally-selected company, fetched once per change rather than on
    // every render (see class doc on rawHolidays).
    effect(() => this.fetchHolidays(this.companyContext.selectedCompanyId(), this.selectedDate()));
  }

  onDateChange(date: Date): void {
    this.selectedDate.set(startOfDay(date));
  }

  goPrevDay(): void {
    this.selectedDate.update((date) => this.addDays(date, -1));
  }

  goNextDay(): void {
    this.selectedDate.update((date) => this.addDays(date, 1));
  }

  goToday(): void {
    this.selectedDate.set(startOfDay(new Date()));
  }

  onCellClick(cell: ScheduleGridCell): void {
    if (cell.kind === 'break') {
      this.breakClicked.emit(cell.source as ScheduleBreakCellDto);
    } else {
      this.appointmentClicked.emit(cell.source as AppointmentScheduleCellDto);
    }
  }

  onEmptySlotClick(event: ScheduleEmptySlotClickEvent): void {
    const date = new Date(this.selectedDate());
    date.setHours(Math.floor(event.startMinutes / 60), event.startMinutes % 60, 0, 0);
    this.emptySlotClick.emit({
      startsAt: date,
      employeeId: event.columnId,
      companyId: this.companyContext.selectedCompanyId(),
    });
  }

  /** Public so ScheduleComponent can trigger a reload after closing whichever
   * dialog it opened for a cell click - this component doesn't need to know
   * why, only that its data may be stale. */
  refetch(): void {
    this.fetch(this.selectedDate(), {
      status: this.statusFilter(),
      executionMode: this.executionModeFilter(),
      service: this.serviceFilter(),
      companyId: this.companyContext.selectedCompanyId(),
      roomId: this.roomFilter(),
    });
  }

  private fetch(date: Date, filters: ScheduleFilters): void {
    const token = ++this.scheduleRequestToken;
    this.loading.set(true);
    const from = toStartOfDayIso(date);
    const to = toEndOfDayIso(date);
    forkJoin({
      feed: this.appointmentsService.getSchedule({
        from,
        to,
        companyId: filters.companyId ?? undefined,
        status: filters.status ?? undefined,
        executionMode: filters.executionMode ?? undefined,
        serviceId: filters.service ?? undefined,
        roomId: filters.roomId ?? undefined,
      }),
      birthdays: this.birthdays(from, to),
    })
      .pipe(
        finalize(() => {
          if (token === this.scheduleRequestToken) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: ({ feed, birthdays }) => {
          if (token !== this.scheduleRequestToken) {
            return;
          }
          this.rawCells.set(feed.appointments);
          this.rawBreaks.set(feed.breaks);
          this.rawBirthdays.set(birthdays);
        },
        // The interceptor toast explains the failure; never leave the previous
        // period's appointments under the newly selected date.
        error: () => {
          if (token !== this.scheduleRequestToken) {
            return;
          }
          this.rawCells.set([]);
          this.rawBreaks.set([]);
          this.rawBirthdays.set([]);
        },
      });
  }

  /** Birthdays are a decoration and need clients.view - without it (or on any
   * failure) the schedule itself must still load. */
  private birthdays(from: string, to: string): Observable<BirthdayDto[]> {
    if (!this.currentEmployeeService.hasGrant('clients.view')) {
      return of([]);
    }
    return this.clientsService.getBirthdays(from, to, { suppressErrorToast: true }).pipe(catchError(() => of<BirthdayDto[]>([])));
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private fetchHolidays(companyId: string | null, date: Date): void {
    const token = ++this.holidaysRequestToken;
    if (!companyId) {
      this.rawHolidays.set([]);
      return;
    }
    this.companyHolidaysService.getForYear(companyId, date.getFullYear()).subscribe((holidays) => {
      if (token === this.holidaysRequestToken) {
        this.rawHolidays.set(holidays);
      }
    });
  }
}
