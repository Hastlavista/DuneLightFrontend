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
}
