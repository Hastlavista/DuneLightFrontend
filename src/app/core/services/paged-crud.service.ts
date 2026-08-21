import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { PagedQuery, PagedResult } from '../models/paged-result.model';

/**
 * Base for the admin "šifrarnik" CRUD screens (Lokacije, Usluge, and whatever
 * follows). All of these endpoints share the same shape:
 * GET (paged list) / GET {id} / POST / PUT {id} / PATCH {id}/activate /
 * PATCH {id}/deactivate / DELETE {id}. Subclass with the concrete DTO/request
 * types and the resource URL - see LocationsService, ServicesService.
 */
export abstract class PagedCrudService<TDto, TUpsertRequest> {
  protected abstract readonly resourceUrl: string;

  constructor(protected readonly http: HttpClient) {}

  /** `suppressErrorToast` mirrors SUPPRESS_ERROR_TOAST for background/preload
   * fetches (e.g. the global location switcher) that handle failure silently.
   * `extraParams` covers resource-specific list filters (e.g. Usluge's
   * executionMode) without polluting the shared PagedQuery shape - falsy
   * values (undefined/null/'') are omitted so callers can pass an "unset" filter
   * directly. */
  getPage(
    query: PagedQuery,
    options?: {
      suppressErrorToast?: boolean;
      extraParams?: Record<string, string | number | boolean | null | undefined>;
    },
  ): Observable<PagedResult<TDto>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) {
      params = params.set('search', query.search);
    }
    // Show-inactive switch contract: omit isActive entirely to get all records,
    // only ever send isActive=true (never false) - see PagedQuery.
    if (query.isActive !== undefined) {
      params = params.set('isActive', query.isActive);
    }
    for (const [key, value] of Object.entries(options?.extraParams ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value);
      }
    }
    return this.http.get<PagedResult<TDto>>(this.resourceUrl, {
      params,
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  getById(id: string): Observable<TDto> {
    return this.http.get<TDto>(`${this.resourceUrl}/${id}`);
  }

  /** `suppressErrorToast` lets a caller handle specific error codes inline
   * (e.g. RosterEntryFormDialogComponent's LEAVE_FUND_EXCEEDED) instead of the
   * default toast - same opt-in convention as getPage's option. */
  create(request: TUpsertRequest, options?: { suppressErrorToast?: boolean }): Observable<TDto> {
    return this.http.post<TDto>(this.resourceUrl, request, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  update(id: string, request: TUpsertRequest, options?: { suppressErrorToast?: boolean }): Observable<TDto> {
    return this.http.put<TDto>(`${this.resourceUrl}/${id}`, request, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, options?.suppressErrorToast ?? false),
    });
  }

  activate(id: string): Observable<TDto> {
    return this.http.patch<TDto>(`${this.resourceUrl}/${id}/activate`, null);
  }

  deactivate(id: string): Observable<TDto> {
    return this.http.patch<TDto>(`${this.resourceUrl}/${id}/deactivate`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.resourceUrl}/${id}`);
  }
}
