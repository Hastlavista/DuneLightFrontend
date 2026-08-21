import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RecurringScheduleBreakCreateRequest,
  ScheduleBreakCreateRequest,
  ScheduleBreakDto,
  ScheduleBreakQuery,
  ScheduleBreakUpdateRequest,
} from '../models/schedule-break.model';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { PlusSafeUrlCodec } from '../http/plus-safe-url-codec';

/** Pauza (frontend #22) - trainer breaks shown alongside termini on the
 * schedule grids (see ScheduleFeedDto.breaks, returned inline by
 * AppointmentsService.getSchedule) but created/edited/deleted through this
 * dedicated resource. Not a PagedCrudService subclass, same reasoning as
 * AppointmentsService: getAll() is a flat, date-ranged array like
 * getSchedule(), not a PagedResult, and PUT here is a genuine full replace
 * (unlike appointments' partial PATCH endpoints). */
@Injectable({ providedIn: 'root' })
export class ScheduleBreaksService {
  private readonly resourceUrl = `${environment.apiUrl}/api/schedule-breaks`;

  constructor(private readonly http: HttpClient) {}

  /** GET /api/schedule-breaks/{id} - the full ScheduleBreakDto, fetched by
   * ScheduleBreakDialogComponent before showing its edit form (the grid only
   * hands it a ScheduleBreakCellDto, see that type's doc). */
  getById(id: string): Observable<ScheduleBreakDto> {
    return this.http.get<ScheduleBreakDto>(`${this.resourceUrl}/${id}`);
  }

  /** POST /api/schedule-breaks - a single, one-off break. 409
   * APPOINTMENT_OVERLAP (colliding with another break or a termin of the same
   * trainer) is a hard block, left to the default error toast - same
   * treatment as AppointmentsService.create(). */
  create(request: ScheduleBreakCreateRequest): Observable<ScheduleBreakDto> {
    return this.http.post<ScheduleBreakDto>(this.resourceUrl, request);
  }

  /** POST /api/schedule-breaks/recurring - returns every generated occurrence,
   * all sharing one recurrenceGroupId. Error toast is always suppressed here:
   * on 409 RECURRING_CONFLICT the caller renders the same conflict-list panel
   * NewAppointmentDialogComponent uses, see AppointmentsService.createRecurring's
   * doc for the identical convention. */
  createRecurring(request: RecurringScheduleBreakCreateRequest): Observable<ScheduleBreakDto[]> {
    return this.http.post<ScheduleBreakDto[]>(`${this.resourceUrl}/recurring`, request, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
    });
  }

  /** PUT /api/schedule-breaks/{id} - full replace, see ScheduleBreakUpdateRequest. */
  update(id: string, request: ScheduleBreakUpdateRequest): Observable<ScheduleBreakDto> {
    return this.http.put<ScheduleBreakDto>(`${this.resourceUrl}/${id}`, request);
  }

  /** DELETE /api/schedule-breaks/{id} - a real delete, no status/soft-delete
   * trail (unlike cancelling a termin) - the break is simply gone. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.resourceUrl}/${id}`);
  }

  /** GET /api/schedule-breaks - flat array, not paged, same `from`/`to`
   * convention as AppointmentsService.getSchedule. Not currently called by any
   * screen (the schedule grids get their breaks from ScheduleFeedDto.breaks
   * instead) - kept for parity with the full backend contract. */
  getAll(
    query: ScheduleBreakQuery,
    options?: { suppressErrorToast?: boolean },
  ): Observable<ScheduleBreakDto[]> {
    let params = new HttpParams({ encoder: new PlusSafeUrlCodec() })
      .set('from', query.from)
      .set('to', query.to);
    if (query.employeeId) {
      params = params.set('employeeId', query.employeeId);
    }
    if (query.companyId) {
      params = params.set('companyId', query.companyId);
    }
    return this.http.get<ScheduleBreakDto[]>(this.resourceUrl, {
      params,
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }
}
