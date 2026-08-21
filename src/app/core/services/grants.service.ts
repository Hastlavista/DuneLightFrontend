import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GrantDto } from '../models/permissions.model';

/** GET /api/grants - the static grant catalog (Owner-only), used to build the
 * grouped-by-module checkbox list on the GrantGroup form. Not a
 * PagedCrudService: a single read-only endpoint, no paging/CRUD at all. */
@Injectable({ providedIn: 'root' })
export class GrantsService {
  private readonly resourceUrl = `${environment.apiUrl}/api/grants`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<GrantDto[]> {
    return this.http.get<GrantDto[]>(this.resourceUrl);
  }
}
