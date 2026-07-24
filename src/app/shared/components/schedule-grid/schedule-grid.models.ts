import { AppointmentScheduleCellDto, AppointmentStatus } from '../../../core/models/appointment.model';

/** One column of the schedule grid - a trainer (grid A) or a day of the week
 * (grid B). Deliberately generic: ScheduleGridComponent doesn't know or care
 * which domain concept a column represents. */
export interface ScheduleGridColumn {
  id: string;
  label: string;
  subLabel?: string;
}

/** One appointment block, pre-resolved to display-ready strings by the parent
 * (ScheduleDayGridComponent/ScheduleWeekGridComponent) via
 * toScheduleGridCell() - the grid itself only positions and renders. */
export interface ScheduleGridCell {
  id: string;
  columnId: string;
  /** Minutes since local midnight - the grid's only notion of "when", shared
   * by both grids since each one's columns already fix the calendar day. */
  startMinutes: number;
  durationMinutes: number;
  colorHex: string;
  /** Only set when "sve lokacije" is selected - renders as a small colored dot. */
  locationColorHex?: string | null;
  title: string;
  subtitle: string;
  cancelled: boolean;
  status: AppointmentStatus;
  source: AppointmentScheduleCellDto;
}

/** Emitted on a click that lands on empty grid space (not an appointment
 * block) - opens NewAppointmentDialogComponent, see
 * DayEmptySlotEvent/WeekEmptySlotEvent for how each grid resolves this into
 * a full date/trainer/location. */
export interface ScheduleEmptySlotClickEvent {
  columnId: string;
  startMinutes: number;
}
