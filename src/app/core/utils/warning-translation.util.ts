import { TranslateService } from '@ngx-translate/core';
import { WarningDto } from '../models/api-error.model';

const UNKNOWN_WARNING_KEY = 'warnings.UNKNOWN';

/** Maps a backend WarningDto to its translated, ready-to-toast message -
 * mirrors error-translation.util.ts's resolveErrorMessage, but for the
 * non-blocking `warnings.<code>` i18n namespace. `details` (when present) is
 * passed straight through as ngx-translate interpolation params. */
export function resolveWarningMessage(translate: TranslateService, warning: WarningDto): string {
  const key = `warnings.${warning.code}`;
  const resolved = translate.instant(key, warning.details);
  return resolved === key ? translate.instant(UNKNOWN_WARNING_KEY) : resolved;
}
