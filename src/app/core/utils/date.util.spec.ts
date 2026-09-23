import { addDays, dateFromLocalKey } from '../../shared/components/schedule-grid/schedule-date.util';
import { toDateOnly, toEndOfDayIso, toIsoAtMinutes, toLocalIsoFromDate, toStartOfDayIso } from './date.util';

describe('date helpers - local calendar semantics', () => {
  it('toDateOnly is the LOCAL date even shortly after midnight', () => {
    expect(toDateOnly(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05');
    expect(toDateOnly(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  it('dateFromLocalKey round-trips through toDateOnly without a UTC shift', () => {
    const date = dateFromLocalKey('2026-10-05');
    expect(date.getHours()).toBe(0);
    expect(toDateOnly(date)).toBe('2026-10-05');
  });

  it('toStartOfDayIso is local midnight of that day, including across the spring DST change', () => {
    for (const day of [28, 29, 30]) {
      const iso = toStartOfDayIso(new Date(2026, 2, day, 15));
      const parsed = new Date(iso);
      expect(parsed.getDate()).toBe(day);
      expect(parsed.getHours()).toBe(0);
      expect(parsed.getMinutes()).toBe(0);
    }
  });

  it('toStartOfDayIso / toEndOfDayIso stay inside the same local day around the autumn DST change', () => {
    for (const day of [24, 25, 26]) {
      const start = new Date(toStartOfDayIso(new Date(2026, 9, day, 15)));
      const end = new Date(toEndOfDayIso(new Date(2026, 9, day)));
      expect([start.getDate(), start.getHours()]).toEqual([day, 0]);
      expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([day, 23, 59]);
    }
  });

  it('toIsoAtMinutes places a time on a DST-change day at that exact local time', () => {
    const moved = new Date(toIsoAtMinutes(new Date(2026, 2, 29), 10 * 60));
    expect([moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([29, 10, 0]);
  });

  it('toLocalIsoFromDate still preserves an ordinary instant exactly', () => {
    const instant = new Date(2026, 6, 14, 9, 45, 12, 345);
    expect(new Date(toLocalIsoFromDate(instant)).getTime()).toBe(instant.getTime());
  });

  it('addDays steps whole local days across a DST change (no 24h-in-ms drift)', () => {
    const beforeChange = new Date(2026, 2, 28);
    const next = addDays(beforeChange, 1);
    const afterNext = addDays(beforeChange, 2);
    expect([next.getDate(), next.getHours()]).toEqual([29, 0]);
    expect([afterNext.getDate(), afterNext.getHours()]).toEqual([30, 0]);
  });
});
