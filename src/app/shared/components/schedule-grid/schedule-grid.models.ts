import { AppointmentScheduleCellDto, AppointmentStatus } from '../../../core/models/appointment.model';
import { ScheduleBreakCellDto } from '../../../core/models/schedule-break.model';

/** One column of the schedule grid - a trainer (grid A) or a day of the week
 * (grid B). Deliberately generic: ScheduleGridComponent doesn't know or care
 * which domain concept a column represents. */
export interface ScheduleGridColumn {
  id: string;
  label: string;
  subLabel?: string;
  /** Grid B (week x days) only - true when this column's calendar day is a
   * holiday for the selected location, see schedule-holiday.util.ts. Always
   * false for grid A (day x trainers), whose columns are trainers, not days -
   * that grid shows a banner above the whole grid instead, see
   * ScheduleDayGridComponent. */
  isHoliday?: boolean;
  holidayName?: string;
}

/** One block on the grid, pre-resolved to display-ready strings by the parent
 * (ScheduleDayGridComponent/ScheduleWeekGridComponent) via
 * toScheduleGridCell()/toScheduleBreakGridCell() - the grid itself only
 * positions and renders, branching on `kind` only for the handful of things
 * that render differently (see schedule-grid.component.html). Both grids mix
 * appointment and break cells into the same `cells` input so they lay out
 * (and overlap-lane) together within a column. */
export interface ScheduleGridCell {
  id: string;
  columnId: string;
  kind: 'appointment' | 'break';
  /** Minutes since local midnight - the grid's only notion of "when", shared
   * by both grids since each one's columns already fix the calendar day. */
  startMinutes: number;
  durationMinutes: number;
  colorHex: string;
  /** Only set when "sve lokacije" is selected - renders as a small colored dot. */
  locationColorHex?: string | null;
  title: string;
  subtitle: string;
  /** True only for an appointment's `NoShow` status - `Cancelled` appointments
   * never reach the grid at all (filtered out before toScheduleGridCell() is
   * called, see ScheduleDayGridComponent/ScheduleWeekGridComponent's
   * `gridCells`), so a cancelled slot renders as plain empty space rather than
   * a dimmed block. Always false for a break. */
  noShow: boolean;
  /** Only set for `kind === 'appointment'`. */
  status?: AppointmentStatus;
  /** True when a client on this appointment has a birthday on the
   * appointment's calendar date - see toScheduleGridCell. Always false until
   * the backend adds `clientIds` to AppointmentScheduleCellDto, and always
   * false for a break (no clients). */
  hasBirthday: boolean;
  source: AppointmentScheduleCellDto | ScheduleBreakCellDto;
}

/** Emitted on a click that lands on empty grid space (not an appointment
 * block) - opens NewAppointmentDialogComponent, see
 * DayEmptySlotEvent/WeekEmptySlotEvent for how each grid resolves this into
 * a full date/trainer/location. */
export interface ScheduleEmptySlotClickEvent {
  columnId: string;
  startMinutes: number;
}
