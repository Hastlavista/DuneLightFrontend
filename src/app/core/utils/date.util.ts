/** Local-offset ISO 8601 formatting for DateTimeOffset fields. This is the ONLY
 * allowed way to send a date to the backend - never a bare "YYYY-MM-DD" and
 * never a display-formatted string (e.g. "01.07.2026."), since ASP.NET's
 * DateTimeOffset binder rejects both. Used by Cjenik and Zaposlenici today;
 * apply the same convention if Klijenti, Termini, or Roster grow date fields.
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
