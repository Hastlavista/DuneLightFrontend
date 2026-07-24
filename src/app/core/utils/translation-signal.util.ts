import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

/** Ticks whenever ngx-translate's active language or loaded translation set
 * changes. `computed()` only re-evaluates when a signal it read changes -
 * `translate.instant()` isn't one, so a computed() built purely from instant()
 * calls caches whatever it got on its first read (e.g. the raw i18n key, if that
 * read happens before hr.json's async load finishes) and never updates again.
 * Read (and ignore) this signal inside such a computed to give it a real
 * dependency. */
export function translationReadySignal(translate: TranslateService) {
  return toSignal(merge(translate.onLangChange, translate.onTranslationChange), {
    initialValue: null,
  });
}
