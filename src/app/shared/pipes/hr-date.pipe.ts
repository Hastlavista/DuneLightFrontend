import { Pipe, PipeTransform } from '@angular/core';

/** "23.07.2026." - Croatian date format. Same rationale as EurCurrencyPipe: uses
 * Intl directly instead of registering hr locale data globally. Parses ISO
 * DateTimeOffset strings from the backend (see core/utils/date.util.ts for the
 * reverse direction). */
const FORMATTER = new Intl.DateTimeFormat('hr-HR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

@Pipe({ name: 'hrDate' })
export class HrDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value == null ? '' : FORMATTER.format(new Date(value));
  }
}
