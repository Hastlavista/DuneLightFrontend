import { DayOfWeek } from './group.model';

/** Recurrence cycle a WorkingHoursTemplate repeats on - `cycleWeekIndex` on
 * each WorkingHoursIntervalDto is 0 for Weekly, 0/1 ("tjedan A"/"B") for
 * Fortnightly, 0-3 for FourWeekly. */
export type CycleType = 'Weekly' | 'Fortnightly' | 'FourWeekly';

const CYCLE_TYPE_TRANSLATION_KEYS: Record<CycleType, string> = {
  Weekly: 'WORKING_HOURS.CYCLE_TYPE.WEEKLY',
  Fortnightly: 'WORKING_HOURS.CYCLE_TYPE.FORTNIGHTLY',
  FourWeekly: 'WORKING_HOURS.CYCLE_TYPE.FOUR_WEEKLY',
};

export function cycleTypeTranslationKey(type: CycleType): string {
  return CYCLE_TYPE_TRANSLATION_KEYS[type];
}

/** Display order for the cycle type select. */
export const CYCLE_TYPES: CycleType[] = ['Weekly', 'Fortnightly', 'FourWeekly'];

const CYCLE_WEEK_COUNTS: Record<CycleType, number> = { Weekly: 1, Fortnightly: 2, FourWeekly: 4 };

/** How many cycleWeekIndex values (0-based) a cycle type spans - drives how
 * many week sections WorkingHoursTemplateEditorComponent renders. */
export function cycleWeekCount(type: CycleType): number {
  return CYCLE_WEEK_COUNTS[type];
}

/** One work interval of a WorkingHoursTemplate - `startTime`/`endTime` are
 * TimeSpan strings ("HH:mm:ss"), same convention as GroupSlotDto.startTime.
 * Multiple intervals may share the same (cycleWeekIndex, dayOfWeek) pair for a
 * split shift/break; no intervals at all for a given day means "not working". */
export interface WorkingHoursIntervalDto {
  cycleWeekIndex: number;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

/** GET/PUT /api/employees/{employeeId}/working-hours-template and GET/PUT
 * /api/companies/{companyId}/working-hours-template - singleton per owner
 * (Employee XOR Company), upsert semantics, no separate create/id, same shape
 * for both the GET response and the PUT body. `anchorDate` is normalized to
 * the Monday of its week by the backend - treat it as informational, always
 * echo back the value last received from GET/PUT rather than letting the user
 * edit it directly (see WorkingHoursTemplateEditorComponent). PUT is a full
 * replacement of `intervals` - send the complete set every time, not a diff.
 * A day-specific override (e.g. one employee off on an otherwise working day)
 * goes through the existing RosterEntry (`isOverride`), not this endpoint. */
export interface WorkingHoursTemplateDto {
  cycleType: CycleType;
  anchorDate: string;
  intervals: WorkingHoursIntervalDto[];
}

export type AvailabilitySourceKind = 'Template' | 'Override' | 'Absence' | 'None';

/** One resolved interval of GET /api/availability's employee/company/effective
 * arrays - just a time-of-day range for the requested date, no day-of-week/
 * cycleWeekIndex (unlike WorkingHoursIntervalDto - this is already resolved to
 * one concrete calendar day). Same "start"/"end" field names as
 * RosterPlannedIntervalDto, NOT "startTime"/"endTime" like
 * WorkingHoursIntervalDto - this DTO used to (wrongly) claim the latter, which
 * silently broke NewAppointmentDialog's availabilityHint/startsAtOutsideAvailability
 * (every interval read as `undefined` start/end, so the "outside working hours"
 * warning fired for every selected time - see bug report). */
export interface AvailabilityIntervalDto {
  start: string;
  end: string;
}

/** GET /api/availability - resolves the employee's and company's working-hours
 * templates (plus any override/absence) down to concrete intervals for one
 * calendar date. `effectiveIntervals` is the intersection of
 * `employeeIntervals`/`companyIntervals` - what scheduling actually allows;
 * `employeeSource`/`companySource` say which layer (template/override/absence/none)
 * produced each side, for UI messaging. */
export interface AvailabilityDto {
  date: string;
  employeeIntervals: AvailabilityIntervalDto[];
  companyIntervals: AvailabilityIntervalDto[];
  effectiveIntervals: AvailabilityIntervalDto[];
  employeeSource: AvailabilitySourceKind;
  companySource: AvailabilitySourceKind;
}
