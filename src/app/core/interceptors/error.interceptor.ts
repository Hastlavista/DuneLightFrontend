import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { AppError } from '../models/api-error.model';
import { NotificationService } from '../services/notification.service';

/** /api/public/Auth/* requests show their errors inline in the component (login
 * form, change-password form) instead of a toast - unrelated to the logout
 * decision below, which is driven solely by error.code. */
const AUTH_ROUTE_PATTERN = /\/api\/public\/Auth\//;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  // Resolved lazily via Injector.get() (not inject()) so constructing
  // NotificationService - which depends on TranslateService - never happens
  // while TranslateService's own bootstrap HTTP request (loading hr.json) is
  // still in flight through this same interceptor; eagerly injecting it here
  // caused a NG0200 circular dependency on every app load.
  const injector = inject(Injector);
  const isAuthRoute = AUTH_ROUTE_PATTERN.test(req.url);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      const appError = toAppError(err);
      // A 401 means the session expired unless the backend tagged it with a
      // specific auth business code (wrong password, etc.) - a missing/unparsed
      // code on a 401 falls back to the safer "session expired" behavior.
      const isSessionExpired =
        appError.status === 401 &&
        (appError.code === 'UNAUTHORIZED' || appError.code === 'UNKNOWN');

      if (isSessionExpired) {
        auth.logout();
        injector.get(NotificationService).showAppError(appError);
        router.navigate(['/login']);
      } else if (!isAuthRoute && !req.context.get(SUPPRESS_ERROR_TOAST)) {
        injector.get(NotificationService).showAppError(appError);
      }

      return throwError(() => appError);
    }),
  );
};

function toAppError(err: HttpErrorResponse): AppError {
  const body = err.error as {
    error?: { code?: string; message?: string; details?: Record<string, string[]> };
  } | null;

  if (body?.error?.code) {
    return {
      status: err.status,
      code: body.error.code,
      message: body.error.message ?? '',
      details: body.error.details,
    };
  }

  return { status: err.status, code: 'UNKNOWN', message: err.message ?? '' };
}
