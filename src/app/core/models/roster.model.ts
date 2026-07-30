/** GET /api/roster/types/{id} and the items of its paged list. `requiresTime`
 * is informative only - it does NOT drive RosterEntry's create/update shape,
 * `isAbsence` alone does (see RosterEntryDto). */
export interface RosterTypeDto {
  id: string;
  name: string;
  colorHex: string | null;
  countsAsWork: boolean;
  isAbsence: boolean;
  requiresTime: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Body for both POST /api/roster/types and PUT /api/roster/types/{id} -
 * identical shape for both; `isActive` is never sent, it has its own
 * activate/deactivate endpoints. */
export interface RosterTypeUpsertRequest {
  name: string;
  colorHex: string | null;
  countsAsWork: boolean;
  isAbsence: boolean;
  requiresTime: boolean;
  sortOrder: number;
}

/** GET /api/roster/entries/{id} and the items of its paged list. Backend
 * denormalizes `isAbsence`/`countsAsWork` from the entry's type directly onto
 * this DTO - no separate type lookup needed to know which shape a row has.
 * Rad (`isAbsence: false`): `dateFrom` is the single day, `dateTo` is null,
 * `startTime`/`endTime`/`durationHours` are populated. A two-shift day is TWO
 * separate rows, never one row with two ranges. Odsutnost (`isAbsence: true`):
 * `dateFrom`/`dateTo` is the range (`dateTo: null` = still open), time fields
 * are null. `warnings` is transient - only ever populated on the response of
 * Create/Update (e.g. an overlap warning), always empty on a plain GET. */
export interface RosterEntryDto {
  id: string;
  employeeId: string;
  employeeName: string;
  rosterTypeId: string;
  rosterTypeName: string;
  rosterTypeColorHex: string | null;
  isAbsence: boolean;
  countsAsWork: boolean;
  dateFrom: string;
  dateTo: string | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  note: string | null;
  warnings: string[];
}

/** Body for both POST /api/roster/entries and PUT /api/roster/entries/{id} -
 * identical shape for both. Backend branches validation by the chosen type's
 * `isAbsence` (see RosterEntryDto's doc) - the frontend form mirrors that
 * validation before submitting so the user doesn't wait on a round trip.
 * Member may only target their own `employeeId`, and may never change it on
 * update (409 NOT_OWNER otherwise). */
export interface RosterEntryUpsertRequest {
  employeeId: string;
  rosterTypeId: string;
  dateFrom: string;
  dateTo?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
}

/** Query params for GET /api/roster/entries - everything is an optional filter. */
export interface RosterEntryQuery {
  employeeId?: string;
  rosterTypeId?: string;
  from?: string;
  to?: string;
}

/** One roster entry occurring on a specific day of GET /roster/team-monthly's
 * matrix - a day with a two-shift work day carries two of these. */
export interface RosterDayEntryDto {
  rosterEntryId: string;
  rosterTypeId: string;
  rosterTypeName: string;
  rosterTypeColorHex: string | null;
  isAbsence: boolean;
  hours: number | null;
  timeRange: string | null;
}

/** One calendar day column of a team-monthly employee row - `day` is the
 * 1-based day-of-month, present for every day of the month even when `entries`
 * is empty (no gaps). */
export interface RosterDayDto {
  day: number;
  entries: RosterDayEntryDto[];
}

export interface RosterWorkHoursByTypeDto {
  rosterTypeId: string;
  rosterTypeName: string;
  hours: number;
}

export interface RosterAbsenceDaysByTypeDto {
  rosterTypeId: string;
  rosterTypeName: string;
  days: number;
}

/** One employee row of GET /roster/team-monthly. `days` always has exactly as
 * many entries as the month has days, in order. Sums (`workHoursByType`,
 * `totalWorkHours`, `absenceDaysByType`) are computed by the backend - never
 * re-aggregate them from `days` on the frontend. */
export interface TeamMonthlyEmployeeDto {
  employeeId: string;
  employeeName: string;
  days: RosterDayDto[];
  workHoursByType: RosterWorkHoursByTypeDto[];
  totalWorkHours: number;
  absenceDaysByType: RosterAbsenceDaysByTypeDto[];
}

/** GET /api/roster/team-monthly?year=&month=&locationId= - the whole matrix,
 * already assembled server-side (do not rebuild it from a flat entry list). */
export interface TeamMonthlyDto {
  year: number;
  month: number;
  employees: TeamMonthlyEmployeeDto[];
}

/** GET /api/roster/personal?employeeId=&from=&to= - same per-type sums
 * convention as TeamMonthlyEmployeeDto, computed by the backend. Member may
 * only request their own employeeId (409 NOT_OWNER otherwise). */
export interface PersonalRosterDto {
  employeeId: string;
  employeeName: string;
  from: string;
  to: string;
  entries: RosterEntryDto[];
  workHoursByType: RosterWorkHoursByTypeDto[];
  totalWorkHours: number;
  absenceDaysByType: RosterAbsenceDaysByTypeDto[];
}
