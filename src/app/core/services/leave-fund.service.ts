import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { EmployeeLeaveSettingsDto, LeaveFundDto } from '../models/leave-fund.model';

/** Fond godišnjeg odmora (frontend #18) - one EmployeeLeaveSettings singleton
 * per employee (GET/PUT, upsert semantics, same shape as
 * WorkingHoursTemplateService's endpoints) plus a read-only list of currently
 * relevant LeaveFund rows. No POST/id-based CRUD here - manual fund
 * correction (`roster.leave-fund.manage`) is a separate, rarely-used backend
 * endpoint not wired up by this frontend pass. */
@Injectable({ providedIn: 'root' })
export class LeaveFundService {
  constructor(private readonly http: HttpClient) {}

  getSettings(employeeId: string, options?: { suppressErrorToast?: boolean }): Observable<EmployeeLeaveSettingsDto> {
    return this.http.get<EmployeeLeaveSettingsDto>(`${environment.apiUrl}/api/employees/${employeeId}/leave-settings`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  updateSettings(employeeId: string, request: EmployeeLeaveSettingsDto): Observable<EmployeeLeaveSettingsDto> {
    return this.http.put<EmployeeLeaveSettingsDto>(
      `${environment.apiUrl}/api/employees/${employeeId}/leave-settings`,
      request,
    );
  }

  getFunds(employeeId: string, options?: { suppressErrorToast?: boolean }): Observable<LeaveFundDto[]> {
    return this.http.get<LeaveFundDto[]>(`${environment.apiUrl}/api/employees/${employeeId}/leave-funds`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }
}
