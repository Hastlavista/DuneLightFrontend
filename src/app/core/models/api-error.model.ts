/**
 * Normalized error shape produced by the error interceptor. The backend now returns
 * the same structured shape everywhere ({ error: { code, message, details } }),
 * including /api/public/Auth/*. `message` is the backend's raw text - kept only for
 * logging/debugging, never shown to the user. The UI always displays a translation
 * of `code` instead (see core/utils/error-translation.util.ts).
 */
export interface AppError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  /** Set by the error interceptor on a session-expiry 401: it has already logged
   * out and shown the single "session expired" message, so callers that report
   * errors themselves (showAppError) must stay silent. */
  sessionExpired?: boolean;
}

/**
 * Non-blocking counterpart to AppError's `{ code, message, details }` shape,
 * minus `message` - the backend never sends prose for a warning, only a code
 * (and optionally structured `details`) for the frontend to translate via
 * core/utils/warning-translation.util.ts's `warnings.<code>` i18n keys.
 * Carried on AppointmentDto/AppointmentScheduleCellDto/GroupDto/
 * RosterEntryDto's `warnings` arrays and EmployeeDto's single `warning` field.
 */
export interface WarningDto {
  code: string;
  details?: Record<string, unknown>;
}
