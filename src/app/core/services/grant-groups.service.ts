import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GrantGroupAuthoringStateDto,
  GrantGroupCapabilityWriteRequest,
  GrantGroupTemplateDiffDto,
  GrantGroupTemplateMatchDto,
  GrantGroupTemplateUpgradePlanDto,
  GrantGroupTemplateUpgradePlanRequest,
  GrantGroupTemplateUpgradeStatusDto,
} from '../models/capability.model';
import { AssignUserGrantGroupsRequest, GrantGroupDto, GrantGroupUpsertRequest } from '../models/permissions.model';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';

/**
 * GrantGroups (permissions.view/permissions.manage, api/permissions/grant-groups) - deliberately NOT a
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

  /** DefaultRoleTemplate v2 upgrade workflow (plan section 5) - only ever
   * called for a GrantGroup with non-null template provenance; the banner
   * skips this entirely for custom/no-provenance groups (Part N). */
  getTemplateUpgradeStatus(id: string): Observable<GrantGroupTemplateUpgradeStatusDto> {
    return this.http.get<GrantGroupTemplateUpgradeStatusDto>(`${this.resourceUrl}/${id}/template-upgrade-status`);
  }

  /** Read-only diff/preview of an upgrade to `targetVersion` - no DB writes.
   * The returned `stateToken` must be echoed back unchanged on
   * previewTemplateUpgrade/applyTemplateUpgrade. */
  getTemplateUpgradeDiff(id: string, targetVersion: number): Observable<GrantGroupTemplateDiffDto> {
    return this.http.get<GrantGroupTemplateDiffDto>(`${this.resourceUrl}/${id}/template-upgrade-diff`, { params: { targetVersion } });
  }

  /** Dry-run of applyTemplateUpgrade with no DB writes - same validation
   * (stateToken match, complete conflict resolution) as Apply. */
  previewTemplateUpgrade(id: string, request: GrantGroupTemplateUpgradePlanRequest): Observable<GrantGroupTemplateUpgradePlanDto> {
    return this.http.post<GrantGroupTemplateUpgradePlanDto>(`${this.resourceUrl}/${id}/template-upgrade/preview`, request);
  }

  /** Applies the upgrade atomically and returns the fresh GrantGroupAuthoringStateDto
   * (Part J) - the same shape getAuthoringState returns, so callers can reuse
   * reloadAuthoringState()'s existing refresh pattern. `suppressErrorToast`
   * lets the upgrade dialog show GRANT_GROUP_UPGRADE_STATE_CHANGED/
   * GRANT_GROUP_UPGRADE_CONFLICT_RESOLUTION_REQUIRED inline instead of a
   * toast (same idiom as StockService.transfer). */
  applyTemplateUpgrade(id: string, request: GrantGroupTemplateUpgradePlanRequest, options?: { suppressErrorToast?: boolean }): Observable<GrantGroupAuthoringStateDto> {
    return this.http.post<GrantGroupAuthoringStateDto>(`${this.resourceUrl}/${id}/template-upgrade/apply`, request, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }
}
