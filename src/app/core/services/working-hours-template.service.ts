import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { WorkingHoursTemplateDto } from '../models/working-hours.model';

/** Singleton-per-owner working hours template (frontend #16) - Employee XOR
 * Company, GET/PUT upsert only, no POST/id-based CRUD (see
 * WorkingHoursTemplateDto's own doc for why this isn't a PagedCrudService
 * subclass). A missing template (404) is an expected, quiet case for a
 * brand-new owner without a backfilled row yet - callers should pass
 * suppressErrorToast and build their own empty-state default (see
 * WorkingHoursTemplateEditorComponent). */
@Injectable({ providedIn: 'root' })
export class WorkingHoursTemplateService {
  constructor(private readonly http: HttpClient) {}

  getForEmployee(employeeId: string, options?: { suppressErrorToast?: boolean }): Observable<WorkingHoursTemplateDto> {
    return this.http.get<WorkingHoursTemplateDto>(`${environment.apiUrl}/api/employees/${employeeId}/working-hours-template`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  updateForEmployee(employeeId: string, request: WorkingHoursTemplateDto): Observable<WorkingHoursTemplateDto> {
    return this.http.put<WorkingHoursTemplateDto>(
      `${environment.apiUrl}/api/employees/${employeeId}/working-hours-template`,
      request,
    );
  }

  getForCompany(companyId: string, options?: { suppressErrorToast?: boolean }): Observable<WorkingHoursTemplateDto> {
    return this.http.get<WorkingHoursTemplateDto>(`${environment.apiUrl}/api/companies/${companyId}/working-hours-template`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  updateForCompany(companyId: string, request: WorkingHoursTemplateDto): Observable<WorkingHoursTemplateDto> {
    return this.http.put<WorkingHoursTemplateDto>(
      `${environment.apiUrl}/api/companies/${companyId}/working-hours-template`,
      request,
    );
  }
}
