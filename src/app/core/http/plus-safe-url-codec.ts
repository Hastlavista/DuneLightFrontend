import { HttpUrlEncodingCodec } from '@angular/common/http';

/** Angular's default codec deliberately un-encodes %2B back to a literal "+"
 * (see standardEncoding in @angular/common/http) to keep URLs readable. That
 * breaks DateTimeOffset values with a "+" zone offset (e.g. "+02:00") - ASP.NET
 * Core's query parser treats a literal "+" as an encoded space, corrupting the
 * date. Re-encode it after the base codec runs. Use wherever an ISO offset
 * string (see core/utils/date.util.ts) goes into a query param. */
export class PlusSafeUrlCodec extends HttpUrlEncodingCodec {
  override encodeValue(value: string): string {
    return super.encodeValue(value).replace(/\+/g, '%2B');
  }
}
