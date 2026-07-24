/** Conversion between a TimeSpan string ("HH:mm:ss", as GroupSlotDto.startTime
 * is sent/received) and the Date object p-datepicker's timeOnly mode needs.
 * Only the time-of-day portion is meaningful - the date component is
 * arbitrary and never read. */

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function toTimeOfDayString(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function parseTimeOfDay(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}
