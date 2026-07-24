import { DayOfWeek, DAYS_OF_WEEK } from '../../../core/models/group.model';

/** Local-calendar date math for the schedule grids (grid B's week navigation,
 * grid A/B's column<->date bucketing). Deliberately separate from
 * core/utils/date.util.ts, which is only about serializing a Date into the
 * local-offset ISO string the backend expects - everything here stays in
 * plain local Date objects. */

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday-first week start, matching GROUPS.DAYS's Monday-first ordering. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  const mondayFirstIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayFirstIndex);
  return start;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Local calendar-day key ("2026-07-13") - grid B buckets appointments into
 * day columns by this, not by the raw ISO string (which carries a UTC-shifted
 * date if compared naively). */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromLocalKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function dayOfWeekFromDate(date: Date): DayOfWeek {
  const mondayFirstIndex = (date.getDay() + 6) % 7;
  return DAYS_OF_WEEK[mondayFirstIndex];
}

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric' });
const DAY_ONLY_FORMATTER = new Intl.DateTimeFormat('hr-HR', { day: 'numeric' });
const DAY_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' });

export function dayMonthLabel(date: Date): string {
  return DAY_MONTH_FORMATTER.format(date);
}

/** "13. – 19. srpnja 2026." - full range when the week crosses a month/year
 * boundary, otherwise just the end date carries the month/year. */
export function weekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear();
  if (sameMonth) {
    return `${DAY_ONLY_FORMATTER.format(weekStart)}. – ${DAY_MONTH_YEAR_FORMATTER.format(weekEnd)}`;
  }
  return `${DAY_MONTH_YEAR_FORMATTER.format(weekStart)} – ${DAY_MONTH_YEAR_FORMATTER.format(weekEnd)}`;
}
