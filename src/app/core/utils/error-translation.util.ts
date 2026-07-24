import { TranslateService } from '@ngx-translate/core';

const UNKNOWN_ERROR_KEY = 'errors.UNKNOWN';

/** Maps a backend error code to its translated message, falling back to errors.UNKNOWN
 * when no translation exists for that code. */
export function resolveErrorMessage(translate: TranslateService, code: string): string {
  const key = `errors.${code}`;
  const resolved = translate.instant(key);
  return resolved === key ? translate.instant(UNKNOWN_ERROR_KEY) : resolved;
}
