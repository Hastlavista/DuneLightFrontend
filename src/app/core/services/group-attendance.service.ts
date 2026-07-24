import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
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
}
