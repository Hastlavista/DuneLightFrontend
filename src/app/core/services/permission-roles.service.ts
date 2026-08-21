import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AssignUserRolesRequest, RoleDto, RoleUpsertRequest } from '../models/permissions.model';

/**
 * Business-facing Role tags (Owner-only, api/permissions/roles) - NOT to be
 * confused with core/models/role.ts's legacy UserRole (Admin/Member/Reception),
 * which drives authorization; these are purely descriptive (e.g. "Trener") and
 * never checked by a guard. Named PermissionRolesService (file
 * permission-roles.service.ts) specifically to avoid colliding with that
 * legacy RolesService-shaped name. Same "flat array, no paging, own assignment
 * endpoints" shape as GrantGroupsService.
 */
@Injectable({ providedIn: 'root' })
export class PermissionRolesService {
  private readonly resourceUrl = `${environment.apiUrl}/api/permissions/roles`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<RoleDto[]> {
    return this.http.get<RoleDto[]>(this.resourceUrl);
  }

  getById(id: string): Observable<RoleDto> {
    return this.http.get<RoleDto>(`${this.resourceUrl}/${id}`);
  }

  create(request: RoleUpsertRequest): Observable<RoleDto> {
    return this.http.post<RoleDto>(this.resourceUrl, request);
  }

  update(id: string, request: RoleUpsertRequest): Observable<RoleDto> {
    return this.http.put<RoleDto>(`${this.resourceUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.resourceUrl}/${id}`);
  }

  getAssignments(userId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.resourceUrl}/assignments/${userId}`);
  }

  /** Replaces the user's ENTIRE Role set - not an add. */
  setAssignments(userId: string, request: AssignUserRolesRequest): Observable<void> {
    return this.http.put<void>(`${this.resourceUrl}/assignments/${userId}`, request);
  }
}
