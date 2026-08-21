/** Local-offset ISO 8601 formatting for DateTimeOffset fields. This is the ONLY
 * allowed way to send a date to the backend - never a bare "YYYY-MM-DD" and
 * never a display-formatted string (e.g. "01.07.2026."), since ASP.NET's
 * DateTimeOffset binder rejects both. Used by Cjenik, Zaposlenici, Klijenti and
 * Raspored today; apply the same convention if Roster grows date fields too.
 * Deliberately NOT Date.toISOString() - that converts to UTC, shifting local
 * midnight to the previous day. Pair with PlusSafeUrlCodec
 * (core/http/plus-safe-url-codec.ts) when the result goes into a query param,
 * since the "+" in the offset needs to survive URL encoding. */

function pad(value: number, width = 2): string {
  return value.toString().padStart(width, '0');
}

function localOffset(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function toLocalIso(
  date: Date,
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number,
): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}${localOffset(date)}`
  );
}

/** Start of the given local day (00:00:00.000), as an ISO string with local offset. */
export function toStartOfDayIso(date: Date): string {
  return toLocalIso(date, 0, 0, 0, 0);
}

/** End of the given local day (23:59:59.999), as an ISO string with local offset -
 * used for validTo so "vrijedi do 31.12." includes the whole last day. */
export function toEndOfDayIso(date: Date): string {
  return toLocalIso(date, 23, 59, 59, 999);
}

/** ISO string with local offset for a specific time-of-day on the given local
 * calendar day - used by Raspored's drag & drop (PATCH /appointments/{id}/move)
 * to combine a grid column's date with the row position's minutes-from-midnight.
 * `minutesFromMidnight` is intentionally not pre-split into hours/minutes -
 * the schedule grid works in raw minute offsets throughout. */
export function toIsoAtMinutes(date: Date, minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return toLocalIso(date, hours, minutes, 0, 0);
}

/** ISO string with local offset for an arbitrary Date, preserving its own
 * date and time-of-day - used by Raspored's appointment edit form, whose
 * date/time picker returns one combined Date rather than a separate day +
 * minutes-from-midnight (contrast with toIsoAtMinutes). */
export function toLocalIsoFromDate(date: Date): string {
  return toLocalIso(date, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

/** Plain calendar date "YYYY-MM-DD", no time-of-day or offset - used by
 * GET /api/availability's `date` query param, which is a LocalDate on the
 * backend, not a DateTimeOffset (contrast with every other helper in this
 * file). */
export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
