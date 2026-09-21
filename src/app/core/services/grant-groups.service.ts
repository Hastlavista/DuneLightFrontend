import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GrantGroupAuthoringStateDto, GrantGroupCapabilityWriteRequest, GrantGroupTemplateMatchDto } from '../models/capability.model';
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

  createCapabilityBased(request: GrantGroupCapabilityWriteRequest): Observable<GrantGroupDto> {
    return this.http.post<GrantGroupDto>(`${this.resourceUrl}/capability-based`, request);
  }

  updateCapabilityBased(id: string, request: GrantGroupCapabilityWriteRequest): Observable<GrantGroupDto> {
    return this.http.put<GrantGroupDto>(`${this.resourceUrl}/${id}/capability-based`, request);
  }

  getAuthoringState(id: string): Observable<GrantGroupAuthoringStateDto> {
    return this.http.get<GrantGroupAuthoringStateDto>(`${this.resourceUrl}/${id}/authoring-state`);
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

  /** FAZA 1 Part R/M - GET .../{id}/template-match: is this GrantGroup based
   * on a default role template, and (if so) which capability selections does
   * its stable snapshot metadata record. `hasSnapshotMetadata: false` means no
   * capability provenance at all (custom, or predates the capability system) -
   * see GrantGroupTemplateMatchDto's own doc. */
  getTemplateMatch(id: string): Observable<GrantGroupTemplateMatchDto> {
    return this.http.get<GrantGroupTemplateMatchDto>(`${this.resourceUrl}/${id}/template-match`);
  }
}
