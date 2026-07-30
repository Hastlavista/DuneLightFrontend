import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import {
  EmployeeDirectoryDto,
  EmployeeDto,
  EmployeeUpsertRequest,
  EmployeeWithLoginRequest,
  EmployeeWithLoginResponse,
} from '../models/employee.model';
import { PagedResult } from '../models/paged-result.model';
import { UserRole } from '../models/role';
import { PagedCrudService } from './paged-crud.service';

/** Same rationale as PagedCrudService's own LOOKUP_PAGE_SIZE=200 convention -
 * getDirectory() is a lookup, not a real paged list, so it always asks for a
 * generous page size instead of exposing paging to its callers. */
const DIRECTORY_PAGE_SIZE = 200;

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

  /** GET /api/employees/directory - lightweight lookup any logged-in role may
   * call (Admin, Member, Reception), unlike getPage()/`/api/employees` which
   * is Admin-only and 403s for everyone else. Same PagedResult envelope as
   * every other list endpoint (unwrapped here, page fixed at
   * DIRECTORY_PAGE_SIZE so callers never see truncation) - see
   * EmployeeDirectoryDto. Trainer-facing screens (my-week, today, my-shifts,
   * my-clients) must use this instead of getPage() for any "list of trainers"
   * need. */
  getDirectory(isActive?: boolean, options?: { suppressErrorToast?: boolean }): Observable<EmployeeDirectoryDto[]> {
    let params = new HttpParams().set('page', 1).set('pageSize', DIRECTORY_PAGE_SIZE);
    if (isActive !== undefined) {
      params = params.set('isActive', isActive);
    }
    return this.http
      .get<PagedResult<EmployeeDirectoryDto>>(`${this.resourceUrl}/directory`, {
        params,
        context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
      })
      .pipe(map((result) => result.items));
  }
}
