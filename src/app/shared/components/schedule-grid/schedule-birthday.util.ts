import { BirthdayDto } from '../../../core/models/client.model';
import { localDateKey } from './schedule-date.util';

/** Builds a clientId -> local date key ("2026-07-13") lookup from a
 * GET /api/clients/birthdays?from=&to= response, for matching against an
 * appointment's own local date key in toScheduleGridCell. Keyed by id (not
 * name) so two clients sharing a name can never collide - see
 * AppointmentScheduleCellDto.clientIds. */
export function buildBirthdayLookup(birthdays: BirthdayDto[]): ReadonlyMap<string, string> {
  return new Map(birthdays.map((birthday) => [birthday.id, localDateKey(new Date(birthday.nextOccurrence))]));
}
