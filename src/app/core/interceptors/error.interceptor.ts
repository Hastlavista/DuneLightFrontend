import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { AppError } from '../models/api-error.model';
import { NotificationService } from '../services/notification.service';
import { resolveErrorMessage } from '../utils/error-translation.util';

/** /api/public/Auth/* requests show their errors inline in the component (login
 * form, change-password form) instead of a toast, and never trigger the
 * auto-logout below - you're not logged in yet (Login) or already are and just
 * mistyped a password (ChangePassword), neither of which means the session
 * itself is invalid. */
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
      // Any 401 outside the auth routes means the current session can no
      // longer authenticate - expired/invalid token, or (since the backend
      // deactivates the linked User when an Employee is hard-deleted) an
      // account disabled after login. Deliberately NOT filtered by
      // appError.code: the backend can introduce new 401 business codes (e.g.
      // "account disabled") without the frontend needing to enumerate them -
      // a 401 here always means "log out and re-authenticate".
      const isSessionExpired = appError.status === 401 && !isAuthRoute;

      if (isSessionExpired) {
        auth.logout();
        // Always the generic "session expired" copy, not appError's own
        // message/code - the backend's specific 401 reason (expired token,
        // disabled account, ...) isn't necessarily translated and isn't
        // useful to the user; what they need to know is "log in again".
        const translate = injector.get(TranslateService);
        injector.get(NotificationService).showError(resolveErrorMessage(translate, 'UNAUTHORIZED'));
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
