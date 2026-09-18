import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppointmentDto } from '../models/appointment.model';
import { GroupAttendanceListDto, SetGroupAttendanceRequest } from '../models/group-attendance.model';

/** Attendance for one group appointment occurrence - nested under
 * /api/groups/appointments/{appointmentId}, not under a group id (an
 * appointment belongs to exactly one group already). */
@Injectable({ providedIn: 'root' })
export class GroupAttendanceService {
  private readonly resourceUrl = `${environment.apiUrl}/api/groups/appointments`;

  constructor(private readonly http: HttpClient) {}

  getAttendance(appointmentId: string): Observable<GroupAttendanceListDto> {
    return this.http.get<GroupAttendanceListDto>(`${this.resourceUrl}/${appointmentId}/attendance`);
  }

  /** One call per client - there is no batch endpoint (SetGroupAttendanceRequest
   * carries a single clientId). */
  setAttendance(appointmentId: string, request: SetGroupAttendanceRequest): Observable<GroupAttendanceListDto> {
    return this.http.post<GroupAttendanceListDto>(`${this.resourceUrl}/${appointmentId}/attendance`, request);
  }

  /** PATCH /api/groups/appointments/{id}/complete - no body. Occurrence-level
   * "done" (Scheduled -> Completed); does NOT touch any Booking row, each is
   * resolved independently via attendance/confirm. Allows closing with
   * unresolved (still Confirmed) bookings - the response's `warnings` then
   * carries GROUP_APPOINTMENT_UNRESOLVED_BOOKINGS, a non-blocking warning, not
   * a failure. */
  completeAppointment(appointmentId: string): Observable<AppointmentDto> {
    return this.http.patch<AppointmentDto>(`${this.resourceUrl}/${appointmentId}/complete`, null);
  }
}
