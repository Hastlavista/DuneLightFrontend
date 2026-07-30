import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { finalize } from 'rxjs';
import { AppointmentScheduleCellDto, AppointmentStatus } from '../../../core/models/appointment.model';
import { dayOfWeekShortTranslationKey } from '../../../core/models/group.model';
import { LocationDto } from '../../../core/models/location.model';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../core/utils/date.util';
import { toScheduleGridCell } from '../schedule-grid/schedule-cell-view.util';
import {
  addDays,
  dateFromLocalKey,
  dayMonthLabel,
  dayOfWeekFromDate,
  localDateKey,
  startOfWeek,
  weekRangeLabel,
} from '../schedule-grid/schedule-date.util';
import { ScheduleGridComponent } from '../schedule-grid/schedule-grid.component';
import { ScheduleEmptySlotClickEvent, ScheduleGridCell, ScheduleGridColumn } from '../schedule-grid/schedule-grid.models';

const WEEK_COLUMN_WIDTH_PX = 140;

/** Consumed by ScheduleComponent to open NewAppointmentDialogComponent
 * prefilled with the clicked column/row - see ScheduleEmptySlotClickEvent. */
export interface WeekEmptySlotEvent {
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
  private readonly locationContext = inject(LocationContextService);
  private readonly translate = inject(TranslateService);

  readonly employeeId = input<string | null>(null);
  readonly statusFilter = input<AppointmentStatus | null>(null);
  readonly serviceCategoryFilter = input<string | null>(null);
  readonly serviceFilter = input<string | null>(null);
  /** Fetched once by ScheduleComponent and shared with both grids - see
   * MyShiftsComponent for the same "fetch once, pass down via @Input" pattern
   * applied to Roster's team/personal tabs. */
  readonly activeLocations = input<LocationDto[]>([]);

  readonly emptySlotClick = output<WeekEmptySlotEvent>();
  readonly appointmentClicked = output<AppointmentScheduleCellDto>();

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly loading = signal(false);
  private readonly rawCells = signal<AppointmentScheduleCellDto[]>([]);
  private readonly locationColors = computed<Map<string, string | null>>(
    () => new Map(this.activeLocations().map((location) => [location.id, location.colorHex])),
  );

  readonly columnWidthPx = WEEK_COLUMN_WIDTH_PX;
  readonly rangeLabel = computed(() => weekRangeLabel(this.weekStart()));

  readonly columns = computed<ScheduleGridColumn[]>(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        id: localDateKey(date),
        label: this.translate.instant(dayOfWeekShortTranslationKey(dayOfWeekFromDate(date))),
        subLabel: dayMonthLabel(date),
      };
    });
  });

  readonly gridCells = computed<ScheduleGridCell[]>(() => {
    const showLocationBadge = this.locationContext.selectedLocationId() === null;
    const colors = this.locationColors();
    return this.rawCells().map((dto) =>
      toScheduleGridCell(
        dto,
        localDateKey(new Date(dto.startsAt)),
        showLocationBadge ? (colors.get(dto.locationId) ?? null) : null,
        this.translate,
      ),
    );
  });

  constructor() {
    effect(() => {
      const employeeId = this.employeeId();
      const weekStart = this.weekStart();
      const filters: ScheduleFilters = {
        status: this.statusFilter(),
        category: this.serviceCategoryFilter(),
        service: this.serviceFilter(),
        locationId: this.locationContext.selectedLocationId(),
      };

      if (!employeeId) {
        this.rawCells.set([]);
        return;
      }
      this.fetch(employeeId, weekStart, filters);
    });
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
    this.appointmentClicked.emit(cell.source);
  }

  onEmptySlotClick(event: ScheduleEmptySlotClickEvent): void {
    const employeeId = this.employeeId();
    if (!employeeId) {
      return;
    }
    const date = dateFromLocalKey(event.columnId);
    date.setHours(Math.floor(event.startMinutes / 60), event.startMinutes % 60, 0, 0);
    this.emptySlotClick.emit({ startsAt: date, employeeId, locationId: this.locationContext.selectedLocationId() });
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
      category: this.serviceCategoryFilter(),
      service: this.serviceFilter(),
      locationId: this.locationContext.selectedLocationId(),
    });
  }

  private fetch(employeeId: string, weekStart: Date, filters: ScheduleFilters): void {
    this.loading.set(true);
    this.appointmentsService
      .getSchedule({
        from: toStartOfDayIso(weekStart),
        to: toEndOfDayIso(addDays(weekStart, 6)),
        employeeId,
        locationId: filters.locationId ?? undefined,
        status: filters.status ?? undefined,
        serviceCategoryId: filters.category ?? undefined,
        serviceId: filters.service ?? undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((cells) => this.rawCells.set(cells));
  }
}
