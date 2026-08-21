import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AssignUserGrantGroupsRequest, GrantGroupDto, GrantGroupUpsertRequest } from '../models/permissions.model';

/**
 * GrantGroups (Owner-only, api/permissions/grant-groups) - deliberately NOT a
 * PagedCrudService: GET is a flat array (no paging), there's no
 * activate/deactivate concept, and assignment to a user is a separate pair of
 * endpoints under this same resource rather than a field on the employee.
 */
@Injectable({ providedIn: 'root' })
export class GrantGroupsService {
  private readonly resourceUrl = `${environment.apiUrl}/api/permissions/grant-groups`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<GrantGroupDto[]> {
    return this.http.get<GrantGroupDto[]>(this.resourceUrl);
  }

  getById(id: string): Observable<GrantGroupDto> {
    return this.http.get<GrantGroupDto>(`${this.resourceUrl}/${id}`);
  }

  create(request: GrantGroupUpsertRequest): Observable<GrantGroupDto> {
    return this.http.post<GrantGroupDto>(this.resourceUrl, request);
  }

  update(id: string, request: GrantGroupUpsertRequest): Observable<GrantGroupDto> {
    return this.http.put<GrantGroupDto>(`${this.resourceUrl}/${id}`, request);
  }

  /** 409 REFERENCED_CANNOT_DELETE if any user is still assigned this group -
   * left to the standard error-toast path. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.resourceUrl}/${id}`);
  }

  getAssignments(userId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.resourceUrl}/assignments/${userId}`);
  }

  /** Replaces the user's ENTIRE GrantGroup set - not an add. */
  setAssignments(userId: string, request: AssignUserGrantGroupsRequest): Observable<void> {
    return this.http.put<void>(`${this.resourceUrl}/assignments/${userId}`, request);
  }
}
