import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AppointmentCancelRequest,
  AppointmentCompleteRequest,
  AppointmentCreateRequest,
  AppointmentDto,
  AppointmentMoveRequest,
  AppointmentScheduleCellDto,
  AppointmentScheduleQuery,
  RecurringAppointmentCreateRequest,
} from '../models/appointment.model';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { PlusSafeUrlCodec } from '../http/plus-safe-url-codec';

/** Raspored (frontend #8) - schedule grid read, appointment detail, the
 * dedicated drag & drop "move" endpoint, and (frontend #10) creating/billing/
 * cancelling termini. Not a PagedCrudService subclass: the schedule endpoint
 * returns a flat array, not a PagedResult, and there is no PUT/activate/
 * deactivate here at all - "editing" an appointment only ever happens through
 * one of the dedicated partial-update endpoints below (move/complete/cancel/
 * no-show), never a full replace. */
@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly resourceUrl = `${environment.apiUrl}/api/appointments`;

  constructor(private readonly http: HttpClient) {}

  /** GET /api/appointments/schedule - flat array, not paged. `from`/`to` are
   * required local-offset ISO strings (core/utils/date.util.ts); the "+" in
   * their offset must survive URL encoding, hence PlusSafeUrlCodec. Includes
   * cancelled/no-show rows - filter by `status` if the caller doesn't want them. */
  getSchedule(query: AppointmentScheduleQuery, options?: { suppressErrorToast?: boolean }): Observable<AppointmentScheduleCellDto[]> {
    let params = new HttpParams({ encoder: new PlusSafeUrlCodec() }).set('from', query.from).set('to', query.to);
    if (query.locationId) {
      params = params.set('locationId', query.locationId);
    }
    if (query.employeeId) {
      params = params.set('employeeId', query.employeeId);
    }
    if (query.serviceId) {
      params = params.set('serviceId', query.serviceId);
    }
    if (query.serviceCategoryId) {
      params = params.set('serviceCategoryId', query.serviceCategoryId);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    return this.http.get<AppointmentScheduleCellDto[]>(`${this.resourceUrl}/schedule`, {
      params,
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  getById(id: string): Observable<AppointmentDto> {
    return this.http.get<AppointmentDto>(`${this.resourceUrl}/${id}`);
  }

  /** PATCH /api/appointments/{id}/move - the only endpoint the schedule grid's
   * drag & drop uses (never the full PUT). Returns the full AppointmentDto with
   * `warnings` populated when the new slot overlaps another booking - that is
   * NOT an error, the move still succeeds; show the warnings as a non-blocking
   * toast (see NotificationService.showWarning). */
  move(id: string, request: AppointmentMoveRequest): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.resourceUrl}/${id}/move`, request);
  }

  /** POST /api/appointments/schedule - creates a Scheduled, unbilled
   * appointment ("Zakaži"). 409 APPOINTMENT_OVERLAP (trainer or client already
   * booked) is a hard block now, not a warning - left to the default error
   * toast, the caller just needs to not close its form on error. */
  create(request: AppointmentCreateRequest): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(`${this.resourceUrl}/schedule`, request);
  }

  /** POST /api/appointments/complete - creates an already-billed, Completed
   * appointment in one step ("Upiši odrađeno" on the new-appointment form, no
   * prior Scheduled row involved). */
  complete(request: AppointmentCompleteRequest): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(`${this.resourceUrl}/complete`, request);
  }

  /** PATCH /api/appointments/{id}/complete - bills a previously-Scheduled
   * appointment ("Naplati" from the detail dialog). 409 ALREADY_COMPLETED if
   * someone else billed it in the meantime. */
  completeExisting(id: string, request: AppointmentCompleteRequest): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.resourceUrl}/${id}/complete`, request);
  }

  /** POST /api/appointments/recurring - returns every generated instance
   * (200, not 201), all sharing one recurrenceGroupId. Error toast is always
   * suppressed here: on 409 RECURRING_CONFLICT the caller renders a panel with
   * the full conflict list instead of a toast (see AppointmentDto's model doc
   * and RecurringConflictDetail) - for every other error code on this
   * endpoint, the caller is responsible for showing NotificationService's
   * toast itself (see NewAppointmentDialogComponent). */
  createRecurring(request: RecurringAppointmentCreateRequest): Observable<AppointmentDto[]> {
    return this.http.post<AppointmentDto[]>(`${this.resourceUrl}/recurring`, request, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
    });
  }

  /** POST /api/appointments/{id}/cancel - `returnEntryForClientIds` is an
   * explicit opt-in list, see AppointmentCancelRequest. */
  cancel(id: string, request: AppointmentCancelRequest): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(`${this.resourceUrl}/${id}/cancel`, request);
  }

  /** POST /api/appointments/{id}/no-show - same request shape as cancel(), see
   * AppointmentCancelRequest. */
  noShow(id: string, request: AppointmentCancelRequest): Observable<AppointmentDto> {
    return this.http.post<AppointmentDto>(`${this.resourceUrl}/${id}/no-show`, request);
  }
}
