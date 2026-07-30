import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { finalize } from 'rxjs';
import { AppointmentScheduleCellDto, AppointmentStatus } from '../../../../../core/models/appointment.model';
import { EmployeeColumnEntry } from '../../../../../core/models/employee.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { AppointmentsService } from '../../../../../core/services/appointments.service';
import { LocationContextService } from '../../../../../core/services/location-context.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../../../core/utils/date.util';
import { toScheduleGridCell } from '../../../../../shared/components/schedule-grid/schedule-cell-view.util';
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
  locationId: string | null;
}

interface ScheduleFilters {
  status: AppointmentStatus | null;
  category: string | null;
  service: string | null;
  locationId: string | null;
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
  private readonly locationContext = inject(LocationContextService);
  private readonly translate = inject(TranslateService);

  readonly employees = input.required<EmployeeColumnEntry[]>();
  readonly statusFilter = input<AppointmentStatus | null>(null);
  readonly serviceCategoryFilter = input<string | null>(null);
  readonly serviceFilter = input<string | null>(null);
  /** Fetched once by ScheduleComponent and shared with both grids - see
   * MyShiftsComponent for the same "fetch once, pass down via @Input" pattern
   * applied to Roster's team/personal tabs. */
  readonly activeLocations = input<LocationDto[]>([]);

  readonly emptySlotClick = output<DayEmptySlotEvent>();
  readonly appointmentClicked = output<AppointmentScheduleCellDto>();

  readonly selectedDate = signal(startOfDay(new Date()));
  readonly loading = signal(false);
  private readonly rawCells = signal<AppointmentScheduleCellDto[]>([]);
  private readonly locationColors = computed<Map<string, string | null>>(
    () => new Map(this.activeLocations().map((location) => [location.id, location.colorHex])),
  );

  readonly columnWidthPx = DAY_COLUMN_WIDTH_PX;

  readonly columns = computed<ScheduleGridColumn[]>(() => {
    const locationId = this.locationContext.selectedLocationId();
    return this.employees()
      .filter((employee) => !locationId || employee.locationIds.includes(locationId))
      .map((employee) => ({ id: employee.id, label: `${employee.firstName} ${employee.lastName}` }));
  });

  readonly gridCells = computed<ScheduleGridCell[]>(() => {
    const showLocationBadge = this.locationContext.selectedLocationId() === null;
    const colors = this.locationColors();
    return this.rawCells().map((dto) =>
      toScheduleGridCell(dto, dto.employeeId, showLocationBadge ? (colors.get(dto.locationId) ?? null) : null, this.translate),
    );
  });

  constructor() {
    effect(() => {
      const date = this.selectedDate();
      const filters: ScheduleFilters = {
        status: this.statusFilter(),
        category: this.serviceCategoryFilter(),
        service: this.serviceFilter(),
        locationId: this.locationContext.selectedLocationId(),
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
    this.appointmentClicked.emit(cell.source);
  }

  onEmptySlotClick(event: ScheduleEmptySlotClickEvent): void {
    const date = new Date(this.selectedDate());
    date.setHours(Math.floor(event.startMinutes / 60), event.startMinutes % 60, 0, 0);
    this.emptySlotClick.emit({
      startsAt: date,
      employeeId: event.columnId,
      locationId: this.locationContext.selectedLocationId(),
    });
  }

  /** Public so ScheduleComponent can trigger a reload after closing whichever
   * dialog it opened for a cell click - this component doesn't need to know
   * why, only that its data may be stale. */
  refetch(): void {
    this.fetch(this.selectedDate(), {
      status: this.statusFilter(),
      category: this.serviceCategoryFilter(),
      service: this.serviceFilter(),
      locationId: this.locationContext.selectedLocationId(),
    });
  }

  private fetch(date: Date, filters: ScheduleFilters): void {
    this.loading.set(true);
    this.appointmentsService
      .getSchedule({
        from: toStartOfDayIso(date),
        to: toEndOfDayIso(date),
        locationId: filters.locationId ?? undefined,
        status: filters.status ?? undefined,
        serviceCategoryId: filters.category ?? undefined,
        serviceId: filters.service ?? undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((cells) => this.rawCells.set(cells));
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
