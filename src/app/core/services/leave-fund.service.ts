import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { AppError } from '../models/api-error.model';
import { EmployeeLeaveSettingsDto, LeaveFundDto, LeaveFundsResponse } from '../models/leave-fund.model';

/** Fond godišnjeg odmora (frontend #18) - one EmployeeLeaveSettings singleton
 * per employee (GET/PUT, upsert semantics, same shape as
 * WorkingHoursTemplateService's endpoints) plus a read-only list of currently
 * relevant LeaveFund rows. No POST/id-based CRUD here - manual fund
 * correction (`roster.leave-fund.manage`) is a separate, rarely-used backend
 * endpoint not wired up by this frontend pass.
 *
 * A missing settings/funds row (404, or `LEAVE_SETTINGS_NOT_CONFIGURED` for
 * settings) is an expected, quiet case for a brand-new employee - callers
 * always get a safe default (null / []) instead of an error, so this never
 * needs to be special-cased at every call site. Any other error still
 * propagates. */
@Injectable({ providedIn: 'root' })
export class LeaveFundService {
  constructor(private readonly http: HttpClient) {}

  getSettings(
    employeeId: string,
    options?: { suppressErrorToast?: boolean },
  ): Observable<EmployeeLeaveSettingsDto | null> {
    return this.http
      .get<EmployeeLeaveSettingsDto>(`${environment.apiUrl}/api/employees/${employeeId}/leave-settings`, {
        context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
      })
      .pipe(
        catchError((err: AppError) =>
          err.status === 404 || err.code === 'LEAVE_SETTINGS_NOT_CONFIGURED' ? of(null) : throwError(() => err),
        ),
      );
  }

  updateSettings(employeeId: string, request: EmployeeLeaveSettingsDto): Observable<EmployeeLeaveSettingsDto> {
    return this.http.put<EmployeeLeaveSettingsDto>(
      `${environment.apiUrl}/api/employees/${employeeId}/leave-settings`,
      request,
    );
  }

  getFunds(employeeId: string, options?: { suppressErrorToast?: boolean }): Observable<LeaveFundDto[]> {
    return this.http
      .get<LeaveFundsResponse>(`${environment.apiUrl}/api/employees/${employeeId}/leave-funds`, {
        context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
      })
      .pipe(
        map((response) => response.funds),
        catchError((err: AppError) => (err.status === 404 ? of([]) : throwError(() => err))),
      );
  }
}
