import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GenerateGroupAppointmentsRequest,
  GenerateGroupAppointmentsResult,
  GroupCreateRequest,
  GroupDetailDto,
  GroupDto,
  GroupSlotRequest,
  GroupUpdateRequest,
} from '../models/group.model';

/**
 * Grupe - deliberately NOT a PagedCrudService subclass: GET /api/groups isn't
 * paginated (a flat array), create/update have different shapes than the
 * DTO (no slots/members management there), and slots/members/activation are
 * all separate endpoints. See admin upit #9 for the full contract.
 */
@Injectable({ providedIn: 'root' })
export class GroupsService {
  private readonly resourceUrl = `${environment.apiUrl}/api/groups`;

  constructor(private readonly http: HttpClient) {}

  /** GET /api/groups?isActive= - flat array, no paging. Omit isActive to get
   * every group (see PagedQuery's "show inactive" contract for the same idea). */
  getAll(isActive?: boolean): Observable<GroupDto[]> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('isActive', isActive);
    }
    return this.http.get<GroupDto[]>(this.resourceUrl, { params });
  }

  getById(id: string): Observable<GroupDetailDto> {
    return this.http.get<GroupDetailDto>(`${this.resourceUrl}/${id}`);
  }

  create(request: GroupCreateRequest): Observable<GroupDetailDto> {
    return this.http.post<GroupDetailDto>(this.resourceUrl, request);
  }

  update(id: string, request: GroupUpdateRequest): Observable<GroupDto> {
    return this.http.put<GroupDto>(`${this.resourceUrl}/${id}`, request);
  }

  activate(id: string): Observable<GroupDto> {
    return this.http.patch<GroupDto>(`${this.resourceUrl}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<GroupDto> {
    return this.http.patch<GroupDto>(`${this.resourceUrl}/${id}/deactivate`, null);
  }

  /** Returns the whole GroupDto (incl. the updated slots list), not just the
   * new slot. */
  addSlot(groupId: string, request: GroupSlotRequest): Observable<GroupDto> {
    return this.http.post<GroupDto>(`${this.resourceUrl}/${groupId}/slots`, request);
  }

  updateSlot(groupId: string, slotId: string, request: GroupSlotRequest): Observable<GroupDto> {
    return this.http.put<GroupDto>(`${this.resourceUrl}/${groupId}/slots/${slotId}`, request);
  }

  /** Soft-delete; blocked with 409 LAST_ACTIVE_SLOT if this is the last active
   * slot (shown via the standard error-toast path). */
  deleteSlot(groupId: string, slotId: string): Observable<void> {
    return this.http.delete<void>(`${this.resourceUrl}/${groupId}/slots/${slotId}`);
  }

  /** Always inserts a new membership row - never reactivates a past one, even
   * if the same client left and rejoins (see GroupMemberDto.joinedAt). 409
   * ALREADY_MEMBER if the client already has an active membership. */
  addMember(groupId: string, clientId: string): Observable<GroupDto> {
    return this.http.post<GroupDto>(`${this.resourceUrl}/${groupId}/members`, { clientId });
  }

  deleteMember(groupId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.resourceUrl}/${groupId}/members/${memberId}`);
  }

  /** POST /api/groups/generate-appointments - idempotent, safe to call again for
   * the same range (returns createdCount: 0, everything in skippedCount). A
   * groupId pointing to an existing but inactive group quietly returns zero
   * results rather than erroring. */
  generateAppointments(request: GenerateGroupAppointmentsRequest): Observable<GenerateGroupAppointmentsResult> {
    return this.http.post<GenerateGroupAppointmentsResult>(`${this.resourceUrl}/generate-appointments`, request);
  }
}
