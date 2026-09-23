import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CapabilityDefinitionDto, DefaultRoleTemplateDto } from '../models/capability.model';

/**
 * FAZA 1 Part R - GET /api/permissions/capabilities (permissions.view/permissions.manage), the single
 * authoritative source of capability metadata for the role editor. Read-only
 * in this phase - see CapabilitiesController's own doc (no mutation endpoints
 * yet, capability/template editing is platform-only).
 *
 * Catalog + templates are cached for the lifetime of this service instance
 * (shareReplay(1)) - Part R asks for "one catalog request per relevant
 * role-management session/page" rather than one per capability row. Callers
 * that need a hard refresh (e.g. after a real capability-aware save endpoint
 * exists in a later phase) should re-inject a fresh instance or add explicit
 * invalidation then - not needed for the read-only Phase 1 UI.
 */
@Injectable({ providedIn: 'root' })
export class CapabilitiesService {
  private readonly resourceUrl = `${environment.apiUrl}/api/permissions/capabilities`;
  private readonly templatesUrl = `${environment.apiUrl}/api/permissions/role-templates`;

  private definitions$: Observable<CapabilityDefinitionDto[]> | null = null;
  private templates$: Observable<DefaultRoleTemplateDto[]> | null = null;

  constructor(private readonly http: HttpClient) {}

  /** GET /api/permissions/capabilities - every capability at its latest active version. */
  getDefinitions(): Observable<CapabilityDefinitionDto[]> {
    if (!this.definitions$) {
      this.definitions$ = this.http
        .get<CapabilityDefinitionDto[]>(this.resourceUrl)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.definitions$;
  }

  getDefinitionDetails(key: string, version?: number): Observable<CapabilityDefinitionDto> {
    const url = version ? `${this.resourceUrl}/${key}?version=${version}` : `${this.resourceUrl}/${key}`;
    return this.http.get<CapabilityDefinitionDto>(url);
  }

  /** GET /api/permissions/role-templates - the v1 default templates (admin/trener/recepcija). */
  getTemplates(): Observable<DefaultRoleTemplateDto[]> {
    if (!this.templates$) {
      this.templates$ = this.http
        .get<DefaultRoleTemplateDto[]>(this.templatesUrl)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.templates$;
  }

  getTemplateDetails(key: string, version?: number): Observable<DefaultRoleTemplateDto> {
    const url = version ? `${this.templatesUrl}/${key}?version=${version}` : `${this.templatesUrl}/${key}`;
    return this.http.get<DefaultRoleTemplateDto>(url);
  }
}
