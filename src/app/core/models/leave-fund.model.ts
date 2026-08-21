const MONTH_TRANSLATION_KEYS: Record<number, string> = {
  1: 'COMMON.MONTHS.JANUARY',
  2: 'COMMON.MONTHS.FEBRUARY',
  3: 'COMMON.MONTHS.MARCH',
  4: 'COMMON.MONTHS.APRIL',
  5: 'COMMON.MONTHS.MAY',
  6: 'COMMON.MONTHS.JUNE',
  7: 'COMMON.MONTHS.JULY',
  8: 'COMMON.MONTHS.AUGUST',
  9: 'COMMON.MONTHS.SEPTEMBER',
  10: 'COMMON.MONTHS.OCTOBER',
  11: 'COMMON.MONTHS.NOVEMBER',
  12: 'COMMON.MONTHS.DECEMBER',
};

export function monthTranslationKey(month: number): string {
  return MONTH_TRANSLATION_KEYS[month];
}

/** Display order for building a month Select (1-12). */
export const MONTHS: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

/** Display order for building a day-of-month Select (1-31) - no calendar
 * validation against the paired month (e.g. 30 is a selectable day even
 * alongside February), same "informational repeating pair" contract the
 * backend applies to renewalMonth/Day and carryoverExpiryMonth/Day below. */
export const DAYS_OF_MONTH: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * GET/PUT /api/employees/{employeeId}/leave-settings (frontend #18) - per-
 * employee configuration of the annual leave fund ("Fond godišnjeg odmora"):
 * how many days it grants at each renewal, and when unused carryover days
 * from the previous fund year expire. `renewalMonth`/`renewalDay` and
 * `carryoverExpiryMonth`/`carryoverExpiryDay` are a repeating month+day pair
 * with no year - the backend re-applies them every fund year, not a one-time
 * date. A 404 (or `LEAVE_SETTINGS_NOT_CONFIGURED`) on GET means the employee
 * has no settings yet - render an empty form instead of an error (see
 * EmployeeLeaveFundTabComponent). PUT upserts - same shape in and out, no
 * separate create endpoint, grant `roster.leave-fund.settings.manage`.
 */
export interface EmployeeLeaveSettingsDto {
  annualDays: number;
  renewalMonth: number;
  renewalDay: number;
  carryoverExpiryMonth: number;
  carryoverExpiryDay: number;
}

/**
 * GET /api/employees/{employeeId}/leave-funds - every currently relevant
 * fund: the current fund year, plus a not-yet-expired carryover fund from the
 * previous year (at most two rows, newest first is not guaranteed - sort by
 * `fundYear` if display order matters). `remainingDays` (allocatedDays -
 * usedDays) is already computed server-side - never re-derive it on the
 * frontend. Grant `roster.leave-fund.view.own` (self) or `.view.all` (Admin
 * viewing anyone).
 */
export interface LeaveFundDto {
  fundYear: number;
  openedAt: string;
  expiresAt: string;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
}
