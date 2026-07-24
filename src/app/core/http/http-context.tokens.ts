import { HttpContextToken } from '@angular/common/http';

/** When true, the error interceptor skips its automatic toast for this request
 * (used for calls where the caller decides how to display the error itself, e.g.
 * GET /api/employees/me, whose 404 is an expected, quiet case). */
export const SUPPRESS_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
