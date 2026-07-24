import { Pipe, PipeTransform } from '@angular/core';

/** "25,00 €" - Croatian number format, EUR symbol. Uses Intl directly instead of
 * Angular's CurrencyPipe so it works without registering hr locale data globally
 * (which would also affect date/number pipes elsewhere). Reused by any future
 * šifrarnik showing money (Cjenik, Paketi...). */
const FORMATTER = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' });

@Pipe({ name: 'eurCurrency' })
export class EurCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '' : FORMATTER.format(value);
  }
}
