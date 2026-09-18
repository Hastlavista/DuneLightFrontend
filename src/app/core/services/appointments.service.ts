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
  AppointmentScheduleQuery,
  AvailableSlotsResponseDto,
  BookingCancelRequest,
  BookingCreateRequest,
  BookingDto,
  ClientAppointmentHistoryDto,
  PaymentDto,
  RecurringAppointmentCreateRequest,
} from '../models/appointment.model';
import { PagedResult } from '../models/paged-result.model';
import { ScheduleFeedDto } from '../models/schedule-break.model';
import { WaitlistEntryDto } from '../models/waitlist.model';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { PlusSafeUrlCodec } from '../http/plus-safe-url-codec';

/** Raspored (frontend #8) - schedule grid read, appointment detail, the
 * dedicated drag & drop "move" endpoint, and (frontend #10) creating/billing/
 * cancelling termini. Not a PagedCrudService subclass: the schedule endpoint
 * returns a single ScheduleFeedDto envelope, not a PagedResult, and there is
 * no PUT/activate/deactivate here at all - "editing" an appointment only ever
 * happens through one of the dedicated partial-update endpoints below
 * (move/complete/cancel/no-show), never a full replace. */
@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly resourceUrl = `${environment.apiUrl}/api/appointments`;

  constructor(private readonly http: HttpClient) {}

  /** GET /api/appointments/schedule - returns `{ appointments, breaks }`
   * (frontend #22 - used to return `appointments` as a bare flat array, see
   * ScheduleFeedDto). `from`/`to` are required local-offset ISO strings
   * (core/utils/date.util.ts); the "+" in their offset must survive URL
   * encoding, hence PlusSafeUrlCodec. `appointments` includes cancelled/no-show
   * rows - filter by `status` if the caller doesn't want them. */
  getSchedule(query: AppointmentScheduleQuery, options?: { suppressErrorToast?: boolean }): Observable<ScheduleFeedDto> {
    let params = new HttpParams({ encoder: new PlusSafeUrlCodec() }).set('from', query.from).set('to', query.to);
    if (query.companyId) {
      params = params.set('companyId', query.companyId);
    }
    if (query.employeeId) {
      params = params.set('employeeId', query.employeeId);
    }
    if (query.serviceId) {
      params = params.set('serviceId', query.serviceId);
    }
    if (query.executionMode) {
      params = params.set('executionMode', query.executionMode);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.roomId) {
      params = params.set('roomId', query.roomId);
    }
    return this.http.get<ScheduleFeedDto>(`${this.resourceUrl}/schedule`, {
      params,
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  getById(id: string): Observable<AppointmentDto> {
    return this.http.get<AppointmentDto>(`${this.resourceUrl}/${id}`);
  }

  /** GET /api/appointments/by-client/{clientId} - paged appointment history for
   * one client, individual and group termini together, newest first. Returns
   * `ClientAppointmentHistoryDto`, NOT `AppointmentDto` - a flatter,
   * this-client-only shape that deliberately omits the other clients on a
   * shared appointment (see that DTO's doc) - feeds the client detail page's
   * Termini tab. */
  getByClient(clientId: string, query: { page: number; pageSize: number }): Observable<PagedResult<ClientAppointmentHistoryDto>> {
    const params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    return this.http.get<PagedResult<ClientAppointmentHistoryDto>>(`${this.resourceUrl}/by-client/${clientId}`, { params });
  }

  /** GET /api/appointments/by-employee/{employeeId} - paged history of an
   * employee's own COMPLETED termini only (individual and group together),
   * newest first - "Povijest" tab on the employee profile page. Unlike
   * getByClient, cancelled/no-show rows are excluded server-side, so there's
   * no status column to render on this list. */
  getByEmployee(employeeId: string, query: { page: number; pageSize: number }): Observable<PagedResult<AppointmentDto>> {
    const params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    return this.http.get<PagedResult<AppointmentDto>>(`${this.resourceUrl}/by-employee/${employeeId}`, { params });
  }

  /** PATCH /api/appointments/{id}/move - called from AppointmentDetailDialog's
   * inline edit form (never the full PUT). Returns the full AppointmentDto with
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

  /** GET /api/appointments/available-slots (frontend #24) - see
   * AvailableSlotsResponseDto's doc. `date` is a plain calendar date
   * ("YYYY-MM-DD", core/utils/date.util.ts's toDateOnly), not a DateTimeOffset,
   * same convention as AvailabilityService.get. Error toast is always
   * suppressed - the slider treats a failed lookup the same as "no free slots"
   * rather than interrupting the rest of the form with a toast. */
  getAvailableSlots(query: {
    serviceId: string;
    companyId: string;
    date: string;
    employeeId?: string | null;
  }): Observable<AvailableSlotsResponseDto> {
    let params = new HttpParams().set('serviceId', query.serviceId).set('companyId', query.companyId).set('date', query.date);
    if (query.employeeId) {
      params = params.set('employeeId', query.employeeId);
    }
    return this.http.get<AvailableSlotsResponseDto>(`${this.resourceUrl}/available-slots`, {
      params,
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
    });
  }

  /** GET /api/appointments/{appointmentId}/bookings - every client's Booking
   * row on one appointment (same shape as AppointmentDto.bookings, fetched on
   * its own when only the bookings are needed). */
  getBookings(appointmentId: string): Observable<BookingDto[]> {
    return this.http.get<BookingDto[]>(`${this.resourceUrl}/${appointmentId}/bookings`);
  }

  /** POST /api/appointments/{appointmentId}/bookings - ad-hoc add one client to
   * an existing appointment (e.g. a guest/replacement on a group occurrence
   * outside its member list). */
  addBooking(appointmentId: string, request: BookingCreateRequest): Observable<BookingDto> {
    return this.http.post<BookingDto>(`${this.resourceUrl}/${appointmentId}/bookings`, request);
  }

  /** PATCH /api/appointments/{appointmentId}/bookings/{clientId}/cancel - cancel
   * ONE client's booking without touching the others on the same appointment
   * (e.g. one of two on a duo termin). */
  cancelBooking(appointmentId: string, clientId: string, request: BookingCancelRequest): Observable<BookingDto> {
    return this.http.patch<BookingDto>(`${this.resourceUrl}/${appointmentId}/bookings/${clientId}/cancel`, request);
  }

  /** PATCH /api/appointments/{appointmentId}/bookings/{clientId}/no-show - same
   * shape as cancelBooking(), for a single client's no-show. */
  markBookingNoShow(appointmentId: string, clientId: string, request: BookingCancelRequest): Observable<BookingDto> {
    return this.http.patch<BookingDto>(`${this.resourceUrl}/${appointmentId}/bookings/${clientId}/no-show`, request);
  }

  /** GET /api/appointments/{appointmentId}/bookings/{clientId}/payments - full
   * payment history (incl. voided) of one client's booking - same rows as
   * BookingDto.payments, fetched on their own. */
  getBookingPayments(appointmentId: string, clientId: string): Observable<PaymentDto[]> {
    return this.http.get<PaymentDto[]>(`${this.resourceUrl}/${appointmentId}/bookings/${clientId}/payments`);
  }

  /** PATCH /api/appointments/{appointmentId}/bookings/{clientId}/confirm - no
   * request body. Reverses a Group booking's check-in/cancel back to Confirmed
   * (Completed/NoShow/Cancelled -> Confirmed) - an admin correction, rejected
   * by the backend for Form=Individual. May void a check-in-generated Payment
   * and/or restore a consumed package entry server-side - always reload the
   * Booking (and any locally-held payment/package state) from the response,
   * never patch it locally. */
  confirmBooking(appointmentId: string, clientId: string): Observable<BookingDto> {
    return this.http.patch<BookingDto>(`${this.resourceUrl}/${appointmentId}/bookings/${clientId}/confirm`, null);
  }

  /** GET /api/appointments/{appointmentId}/waitlist - full history for the
   * occurrence, including terminal Promoted/Cancelled/Expired rows, not just
   * the active Waiting queue. */
  getWaitlist(appointmentId: string): Observable<WaitlistEntryDto[]> {
    return this.http.get<WaitlistEntryDto[]>(`${this.resourceUrl}/${appointmentId}/waitlist`);
  }

  /** POST /api/appointments/{appointmentId}/waitlist - only allowed when the
   * occurrence is actually full (409 CAPACITY_AVAILABLE otherwise), and only
   * once per client per occurrence while a Waiting entry is active (409
   * ALREADY_WAITLISTED). */
  joinWaitlist(appointmentId: string, clientId: string): Observable<WaitlistEntryDto> {
    return this.http.post<WaitlistEntryDto>(`${this.resourceUrl}/${appointmentId}/waitlist`, { clientId });
  }

  /** DELETE /api/appointments/{appointmentId}/waitlist/{clientId} - Waiting ->
   * Cancelled, idempotent (a no-op on an already-terminal entry). */
  cancelWaitlistEntry(appointmentId: string, clientId: string): Observable<WaitlistEntryDto> {
    return this.http.delete<WaitlistEntryDto>(`${this.resourceUrl}/${appointmentId}/waitlist/${clientId}`);
  }
}
