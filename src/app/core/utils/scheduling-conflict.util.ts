import { AppointmentStatus } from '../models/appointment.model';
import { DAYS_OF_WEEK, DayOfWeek } from '../models/group.model';
import { AvailabilityIntervalDto } from '../models/working-hours.model';

/** Soft (non-blocking) pre-save checks shared by every place a trainer/room
 * gets picked for a concrete start time - NewAppointmentDialog,
 * AppointmentDetailDialog's move form, and GroupSlotFormDialog. The
 * authoritative check is still server-side; these just drive a confirm
 * dialog ("Nastavi ipak?") before the save call goes out. */

/** Whether the given time range falls fully outside every effective working-hours
 * interval - a termin spanning a gap between split-shift intervals (or the
 * boundary between two of them) still counts as outside, even though each
 * endpoint individually might land inside one. No intervals at all means "not
 * working" for the whole day. */
export function isOutsideAvailability(startMinutes: number, endMinutes: number, effectiveIntervals: AvailabilityIntervalDto[]): boolean {
  if (effectiveIntervals.length === 0) {
    return true;
  }
  return !effectiveIntervals.some((interval) => {
    if (!interval.start || !interval.end) {
      return false;
    }
    const [startH, startM] = interval.start.split(':').map(Number);
    const [endH, endM] = interval.end.split(':').map(Number);
    const intervalStart = startH * 60 + startM;
    const intervalEnd = endH * 60 + endM;
    return startMinutes >= intervalStart && endMinutes <= intervalEnd;
  });
}

export interface RoomOccupancyCandidate {
  id?: string;
  startsAt: string;
  durationMinutes: number;
  status?: AppointmentStatus;
}

/** Whether the candidate [start, start+durationMinutes) range overlaps any
 * existing, still-relevant (not Cancelled/NoShow) appointment already booked
 * for that room - `excludeAppointmentId` leaves out the appointment being
 * moved/edited itself, since it always "overlaps" its own current slot. */
export function isRoomOccupied(
  candidateStart: Date,
  durationMinutes: number,
  existing: RoomOccupancyCandidate[],
  excludeAppointmentId?: string | null,
): boolean {
  const start = candidateStart.getTime();
  const end = start + durationMinutes * 60000;
  return existing.some((appt) => {
    if (excludeAppointmentId && appt.id === excludeAppointmentId) {
      return false;
    }
    if (appt.status === 'Cancelled' || appt.status === 'NoShow') {
      return false;
    }
    const apptStart = new Date(appt.startsAt).getTime();
    const apptEnd = apptStart + appt.durationMinutes * 60000;
    return start < apptEnd && apptStart < end;
  });
}

/** The next calendar date (today included) that falls on `dayOfWeek` - used
 * as a representative concrete date for a group slot's pre-save trainer/room
 * check, since a GroupSlotDto only carries a day-of-week + time-of-day, never
 * a date of its own (see GroupSlotDto's doc). Just a heuristic: a future
 * roster change could make a later occurrence differ, but it's the same
 * "soft, non-authoritative" warning as everywhere else in this file. */
export function nextOccurrenceDate(dayOfWeek: DayOfWeek): Date {
  const targetIndex = DAYS_OF_WEEK.indexOf(dayOfWeek);
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7; // JS Date: Sun=0..Sat=6 -> Mon=0..Sun=6
  const diffDays = (targetIndex - todayIndex + 7) % 7;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffDays);
}
