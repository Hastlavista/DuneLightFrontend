import { AppointmentScheduleCellDto, RecurrenceType } from './appointment.model';

/** GET /api/appointments/schedule's new response envelope (frontend #22) -
 * replaces the old flat `AppointmentScheduleCellDto[]` body. Every caller of
 * AppointmentsService.getSchedule must read `.appointments`/`.breaks` off
 * this instead of treating the response itself as the array - see
 * ScheduleDayGridComponent/ScheduleWeekGridComponent's `fetch()`. */
export interface ScheduleFeedDto {
  appointments: AppointmentScheduleCellDto[];
  breaks: ScheduleBreakCellDto[];
}

/** One entry of `ScheduleFeedDto.breaks` - the lightweight grid-row shape,
 * same split as AppointmentScheduleCellDto vs. AppointmentDto: this is what
 * the feed inlines for rendering, NOT what a click should be edited from.
 * Deliberately has no `recurrenceGroupId` - ScheduleBreakDialogComponent
 * fetches the full ScheduleBreakDto via GET /schedule-breaks/{id} before
 * showing its edit form, exactly like a termin click resolves
 * AppointmentScheduleCellDto -> AppointmentsService.getById ->
 * AppointmentDetailDialogComponent. */
export interface ScheduleBreakCellDto {
  id: string;
  startsAt: string;
  durationMinutes: number;
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  note?: string;
}

/** GET/POST/PUT /api/schedule-breaks[/{id}] - the full break record, fetched
 * by ScheduleBreakDialogComponent via getById() before editing (see
 * ScheduleBreakCellDto's doc for why). `recurrenceGroupId` is only present
 * when the break was created via POST /schedule-breaks/recurring - every
 * generated occurrence shares one, same convention as
 * AppointmentDto.recurrenceGroupId, but there is no dedicated "edit/cancel the
 * whole series" action yet - edit/delete always act on a single occurrence.
 * `createdAt` is always present; `createdBy`/`updatedAt`/`updatedBy` follow
 * the usual absent-when-null convention and aren't rendered anywhere yet. */
export interface ScheduleBreakDto {
  id: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  startsAt: string;
  durationMinutes: number;
  note?: string;
  recurrenceGroupId?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Body for POST /api/schedule-breaks - a single, one-off break. */
export interface ScheduleBreakCreateRequest {
  employeeId: string;
  companyId: string;
  startsAt: string;
  durationMinutes: number;
  note?: string | null;
}

/** Body for POST /api/schedule-breaks/recurring - same recurrence shape as
 * RecurringAppointmentCreateRequest (RecurrenceType/endDate), just without a
 * serviceId/clientIds since a break has neither. Reuses RecurrenceType from
 * appointment.model.ts rather than duplicating the union. */
export interface RecurringScheduleBreakCreateRequest {
  recurrenceType: RecurrenceType;
  employeeId: string;
  companyId: string;
  firstOccurrenceStartsAt: string;
  durationMinutes: number;
  endDate: string;
  note?: string | null;
}

/** Body for PUT /api/schedule-breaks/{id} - a full replace (unlike
 * appointments' dedicated PATCH .../move), so every field is resent even when
 * ScheduleBreakDialogComponent's simple edit form only actually changes
 * time/duration/note. */
export interface ScheduleBreakUpdateRequest {
  employeeId: string;
  companyId: string;
  startsAt: string;
  durationMinutes: number;
  note?: string | null;
}

/** Query params for GET /api/schedule-breaks - `from`/`to` required, same
 * local-offset ISO convention as AppointmentScheduleQuery. */
export interface ScheduleBreakQuery {
  from: string;
  to: string;
  employeeId?: string | null;
  companyId?: string | null;
}
