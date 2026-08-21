import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { finalize, forkJoin } from 'rxjs';
import { AppointmentScheduleCellDto, AppointmentStatus } from '../../../../../core/models/appointment.model';
import { BirthdayDto } from '../../../../../core/models/client.model';
import { EmployeeColumnEntry } from '../../../../../core/models/employee.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { ScheduleBreakCellDto } from '../../../../../core/models/schedule-break.model';
import { ServiceExecutionMode } from '../../../../../core/models/service.model';
import { AppointmentsService } from '../../../../../core/services/appointments.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { LocationContextService } from '../../../../../core/services/location-context.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../../../core/utils/date.util';
import { buildBirthdayLookup } from '../../../../../shared/components/schedule-grid/schedule-birthday.util';
import { toScheduleBreakGridCell, toScheduleGridCell } from '../../../../../shared/components/schedule-grid/schedule-cell-view.util';
import { startOfDay } from '../../../../../shared/components/schedule-grid/schedule-date.util';
import { ScheduleGridComponent } from '../../../../../shared/components/schedule-grid/schedule-grid.component';
import {
  ScheduleEmptySlotClickEvent,
  ScheduleGridCell,
  ScheduleGridColumn,
} from '../../../../../shared/components/schedule-grid/schedule-grid.models';

const DAY_COLUMN_WIDTH_PX = 170;

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
}

/**
 * Grid A - one day x every trainer, the admin "Raspored" default view.
 * Trainer columns are the active employees, narrowed to whichever ones are
 * assigned to the globally-selected location (LocationContextService) - "sve
 * lokacije" shows every active trainer, since the same trainer can work both
 * locations. Location itself is NOT a column split - a trainer's appointments
 * from either location land in the same column, distinguished only by the
 * small location-colored dot on the block (see toScheduleGridCell).
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
  private readonly locationContext = inject(LocationContextService);
  private readonly translate = inject(TranslateService);

  readonly employees = input.required<EmployeeColumnEntry[]>();
  readonly statusFilter = input<AppointmentStatus | null>(null);
  readonly executionModeFilter = input<ServiceExecutionMode | null>(null);
  readonly serviceFilter = input<string | null>(null);
  /** Fetched once by ScheduleComponent and shared with both grids - see
   * MyShiftsComponent for the same "fetch once, pass down via @Input" pattern
   * applied to Roster's team/personal tabs. */
  readonly activeLocations = input<LocationDto[]>([]);

  readonly emptySlotClick = output<DayEmptySlotEvent>();
  readonly appointmentClicked = output<AppointmentScheduleCellDto>();
  readonly breakClicked = output<ScheduleBreakCellDto>();

  readonly selectedDate = signal(startOfDay(new Date()));
  readonly loading = signal(false);
  private readonly rawCells = signal<AppointmentScheduleCellDto[]>([]);
  private readonly rawBreaks = signal<ScheduleBreakCellDto[]>([]);
  private readonly rawBirthdays = signal<BirthdayDto[]>([]);
  private readonly birthdayLookup = computed(() => buildBirthdayLookup(this.rawBirthdays()));
  private readonly locationColors = computed<Map<string, string | null>>(
    () => new Map(this.activeLocations().map((location) => [location.id, location.colorHex])),
  );

  readonly columnWidthPx = DAY_COLUMN_WIDTH_PX;

  readonly columns = computed<ScheduleGridColumn[]>(() => {
    const companyId = this.locationContext.selectedLocationId();
    return this.employees()
      .filter((employee) => !companyId || employee.companyIds.includes(companyId))
      .map((employee) => ({ id: employee.id, label: `${employee.firstName} ${employee.lastName}` }));
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
          dto.employeeId,
          showLocationBadge ? (colors.get(dto.companyId) ?? null) : null,
          this.translate,
          birthdays,
        ),
      );
    const breakCells = this.rawBreaks().map((dto) =>
      toScheduleBreakGridCell(
        dto,
        dto.employeeId,
        showLocationBadge ? (colors.get(dto.companyId) ?? null) : null,
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
        companyId: this.locationContext.selectedLocationId(),
      };
      this.fetch(date, filters);
    });
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
      companyId: this.locationContext.selectedLocationId(),
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
      companyId: this.locationContext.selectedLocationId(),
    });
  }

  private fetch(date: Date, filters: ScheduleFilters): void {
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

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
