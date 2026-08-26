/** GET /api/roster/types/{id} and the items of its paged list. `requiresTime`
 * is informative only - it does NOT drive RosterEntry's create/update shape,
 * `isAbsence` alone does (see RosterEntryDto). `deductsFromLeaveFund`
 * (frontend #18) - this type consumes the employee's annual leave fund on
 * entry - is only ever true when `isAbsence` is also true (backend rejects
 * otherwise with LEAVE_FUND_TYPE_MUST_BE_ABSENCE); the frontend mirrors that
 * by disabling the checkbox until "Odsutnost" is checked (see
 * RosterTypeFormDialogComponent). */
export interface RosterTypeDto {
  id: string;
  name: string;
  colorHex: string | null;
  countsAsWork: boolean;
  isAbsence: boolean;
  requiresTime: boolean;
  deductsFromLeaveFund: boolean;
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
  deductsFromLeaveFund: boolean;
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

/** Where a day's roster picture came from (frontend #17, revised #28):
 * `Actual` means at least one real RosterEntry exists that day (`entries` is
 * populated, `plannedIntervals` always empty - a real record always wins over
 * a prediction); `Assumed` means no real entry exists but the day is
 * past/today AND the employee's WorkingHoursTemplate resolves hours for it
 * (`plannedIntervals` populated instead, `entries` empty) - the backend now
 * counts these hours into `totalWorkHours`/`workHoursByType` under a
 * synthetic "Pretpostavljeno (predložak)" row, so render `Assumed` IDENTICAL
 * to `Actual` (no dashed/muted styling - see TeamMonthlyComponent); `Planned`
 * is the same template-projection idea but for today/future days -
 * genuinely hasn't happened yet, so it keeps the muted/dashed styling;
 * `None` means neither - a genuinely empty day. Only `Planned` cells (never
 * `Assumed`) render the dashed "not yet happened" style. */
export type RosterDaySource = 'Actual' | 'Assumed' | 'Planned' | 'None';

/** One planned interval - the employee's WorkingHoursTemplate resolved down to
 * a concrete time range for one calendar day, same shape as
 * AvailabilityIntervalDto but with the backend's own field names for this
 * endpoint ("start"/"end", not "startTime"/"endTime"). */
export interface RosterPlannedIntervalDto {
  start: string;
  end: string;
}

/** One calendar day column of a team-monthly employee row - `day` is the
 * 1-based day-of-month, present for every day of the month even when `entries`
 * is empty (no gaps). `plannedIntervals` is only ever populated when
 * `source` is `'Planned'` or `'Assumed'` (see RosterDaySource) - `entries` and
 * `plannedIntervals` are never both non-empty for the same day. */
export interface RosterDayDto {
  day: number;
  entries: RosterDayEntryDto[];
  source: RosterDaySource;
  plannedIntervals: RosterPlannedIntervalDto[];
}

/** One row of a `workHoursByType` sum. Usually a real RosterType's hours, but
 * the backend may also include a synthetic row named exactly
 * "Pretpostavljeno (predložak)" (frontend #28) bundling every `Assumed` day's
 * template-resolved hours - it isn't backed by a real RosterType, but is
 * otherwise rendered as a normal row (see PersonalRosterComponent/
 * TeamMonthlyComponent). */
export interface RosterWorkHoursByTypeDto {
  rosterTypeId: string;
  rosterTypeName: string;
  hours: number;
}

/** Exact `rosterTypeName` the backend uses for the synthetic `Assumed`-hours
 * summary row (see RosterWorkHoursByTypeDto) - match on this, not on
 * `rosterTypeId` (it isn't backed by a real RosterType). */
export const ASSUMED_WORK_HOURS_ROW_NAME = 'Pretpostavljeno (predložak)';

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

/** GET /api/roster/team-monthly?year=&month=&companyId= - the whole matrix,
 * already assembled server-side (do not rebuild it from a flat entry list). */
export interface TeamMonthlyDto {
  year: number;
  month: number;
  employees: TeamMonthlyEmployeeDto[];
}

/** One day within [from,to] that has no real RosterEntry but IS a FUTURE day
 * (strictly after today) AND has hours in the employee's WorkingHoursTemplate
 * (frontend #17, revised #28) - see RosterDaySource. Today itself is no
 * longer included here even without a real record - it falls under `Assumed`
 * instead (rendered like a normal completed day, not "planned"). Never
 * generated for a past day. */
export interface RosterPlannedDayDto {
  date: string;
  intervals: RosterPlannedIntervalDto[];
}

/** GET /api/roster/personal?employeeId=&from=&to= - same per-type sums
 * convention as TeamMonthlyEmployeeDto, computed by the backend - never
 * re-aggregate them from `entries`/`plannedDays` on the frontend. Unlike
 * team-monthly's per-day matrix, this DTO has no `Assumed` day list of its
 * own: a past/today day with no real entry (frontend #28) simply isn't
 * itemized as a row here (neither `entries` nor `plannedDays`, which now only
 * covers strictly-future days - see RosterPlannedDayDto), it just silently
 * contributes to `totalWorkHours`/`workHoursByType` via the backend's
 * synthetic "Pretpostavljeno (predložak)" row - see
 * ASSUMED_WORK_HOURS_ROW_NAME. Member may only request their own employeeId
 * (409 NOT_OWNER otherwise). */
export interface PersonalRosterDto {
  employeeId: string;
  employeeName: string;
  from: string;
  to: string;
  entries: RosterEntryDto[];
  plannedDays: RosterPlannedDayDto[];
  workHoursByType: RosterWorkHoursByTypeDto[];
  totalWorkHours: number;
  absenceDaysByType: RosterAbsenceDaysByTypeDto[];
}
