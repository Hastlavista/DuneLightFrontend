import { CompanyHolidayDto } from '../../../core/models/company-holiday.model';
import { localDateKey } from './schedule-date.util';

/** Local date key ("2026-07-13") -> holiday name, built from a
 * GET /api/companies/{companyId}/holidays?year= response. Shared by
 * ScheduleWeekGridComponent (per-column highlight) and ScheduleDayGridComponent
 * (single-day banner) - see their own `holidayLookup`/`todayHolidayName`. */
export function buildHolidayLookup(holidays: CompanyHolidayDto[]): ReadonlyMap<string, string> {
  return new Map(holidays.map((holiday) => [localDateKey(new Date(holiday.date)), holiday.name]));
}
