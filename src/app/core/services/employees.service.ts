import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EmployeeDto,
  EmployeeUpsertRequest,
  EmployeeWithLoginRequest,
  EmployeeWithLoginResponse,
} from '../models/employee.model';
import { UserRole } from '../models/role';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class EmployeesService extends PagedCrudService<EmployeeDto, EmployeeUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/employees`;

  constructor(http: HttpClient) {
    super(http);
  }

  /** POST /api/employees/with-login - the only create path the UI uses. Returns
   * `{ employeeId, userId, email, role }`, not a full EmployeeDto - the caller
   * navigates back to the list rather than trying to render the result. */
  createWithLogin(request: EmployeeWithLoginRequest): Observable<EmployeeWithLoginResponse> {
    return this.http.post<EmployeeWithLoginResponse>(`${this.resourceUrl}/with-login`, request);
  }

  /** PATCH /api/employees/{id}/role - a separate action from update() since it
   * carries its own business rule (409 LAST_ACTIVE_ADMIN). */
  changeRole(id: string, role: UserRole): Observable<EmployeeDto> {
    return this.http.patch<EmployeeDto>(`${this.resourceUrl}/${id}/role`, { role });
  }
}
