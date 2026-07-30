/** Local calendar-month math for the team-monthly matrix's navigation and day
 * columns. Deliberately separate from core/utils/date.util.ts (ISO
 * serialization for the backend) and shared/components/schedule-grid's
 * schedule-date.util.ts (week-oriented, a different grid's concern). */

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const zeroBased = ym.month - 1 + delta;
  const year = ym.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12;
  return { year, month: month + 1 };
}

export function currentYearMonth(): YearMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isCurrentMonth(ym: YearMonth): boolean {
  const now = currentYearMonth();
  return ym.year === now.year && ym.month === now.month;
}

export function todayDayOfMonth(): number {
  return new Date().getDate();
}

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric' });

/** "srpanj 2026." for the matrix's month navigation header. */
export function monthYearLabel(ym: YearMonth): string {
  return MONTH_YEAR_FORMATTER.format(new Date(ym.year, ym.month - 1, 1));
}

export function dateForDay(ym: YearMonth, day: number): Date {
  return new Date(ym.year, ym.month - 1, day);
}
