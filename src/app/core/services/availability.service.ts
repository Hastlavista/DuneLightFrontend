import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { AvailabilityDto } from '../models/working-hours.model';

/** GET /api/availability - resolves an employee's and/or company's working-hours
 * template (plus override/absence) down to concrete intervals for one calendar
 * date (frontend #16). `date` is a plain calendar date ("YYYY-MM-DD", see
 * core/utils/date.util.ts's toDateOnly), not a DateTimeOffset - this endpoint
 * has no time-of-day component of its own to combine it with. */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  constructor(private readonly http: HttpClient) {}

  get(
    query: { employeeId?: string; companyId?: string; date: string },
    options?: { suppressErrorToast?: boolean },
  ): Observable<AvailabilityDto> {
    let params = new HttpParams().set('date', query.date);
    if (query.employeeId) {
      params = params.set('employeeId', query.employeeId);
    }
    if (query.companyId) {
      params = params.set('companyId', query.companyId);
    }
    return this.http.get<AvailabilityDto>(`${environment.apiUrl}/api/availability`, {
      params,
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }
}
