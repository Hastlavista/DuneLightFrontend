import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { DunePreset } from './core/design/dune-preset';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // zone.js isn't a dependency at all (see package.json) - without this call the
    // app has neither zone.js nor an explicit scheduler, so change detection after
    // events that don't originate from an Angular-tracked handler (e.g. a
    // third-party overlay's deferred setTimeout) can silently never run.
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    providePrimeNG({
      theme: {
        preset: DunePreset,
        options: {
          darkModeSelector: false,
        },
      },
    }),
    MessageService,
    ConfirmationService,
    // Only hr.json exists today; add en.json under src/assets/i18n later and it just works.
    provideTranslateService({
      lang: 'hr',
      fallbackLang: 'hr',
      loader: provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
    }),
    // Hold bootstrap until hr.json is in. Otherwise a request that fails during startup (e.g. a stale
    // stored token -> 401 on /api/employees/me) raises its toast before translations exist and shows
    // raw keys ("COMMON.ERROR_TITLE" / "errors.UNKNOWN"). A failed load must not block the app.
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      return firstValueFrom(translate.use('hr').pipe(catchError(() => of(null))));
    }),
  ],
};
