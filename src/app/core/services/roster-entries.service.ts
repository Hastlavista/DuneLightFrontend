import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlusSafeUrlCodec } from '../http/plus-safe-url-codec';
import { PersonalRosterDto, RosterEntryDto, RosterEntryUpsertRequest, TeamMonthlyDto } from '../models/roster.model';
import { PagedCrudService } from './paged-crud.service';

/** Roster (frontend #11) - evidencija radnih sati i odsutnosti, no relation to
 * Raspored/termini. activate()/deactivate() are inherited from
 * PagedCrudService but unused here - RosterEntry has no such concept, only a
 * real delete() (also inherited), unlike termini which only ever get
 * cancelled/no-show. */
@Injectable({ providedIn: 'root' })
export class RosterEntriesService extends PagedCrudService<RosterEntryDto, RosterEntryUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/roster/entries`;

  constructor(http: HttpClient) {
    super(http);
  }

  /** GET /api/roster/team-monthly - the whole employees x days-of-month matrix,
   * pre-assembled server-side (see TeamMonthlyDto). Visible to Admin and
   * Member alike - every row, not just the caller's own. */
  teamMonthly(query: { year: number; month: number; companyId?: string | null }): Observable<TeamMonthlyDto> {
    let params = new HttpParams().set('year', query.year).set('month', query.month);
    if (query.companyId) {
      params = params.set('companyId', query.companyId);
    }
    return this.http.get<TeamMonthlyDto>(`${environment.apiUrl}/api/roster/team-monthly`, { params });
  }

  /** GET /api/roster/personal - one employee's entries + sums over an arbitrary
   * date range. Member may only pass their own employeeId (409 NOT_OWNER
   * otherwise). `from`/`to` are local-offset ISO strings (core/utils/date.util.ts). */
  personal(query: { employeeId: string; from: string; to: string }): Observable<PersonalRosterDto> {
    const params = new HttpParams({ encoder: new PlusSafeUrlCodec() })
      .set('employeeId', query.employeeId)
      .set('from', query.from)
      .set('to', query.to);
    return this.http.get<PersonalRosterDto>(`${environment.apiUrl}/api/roster/personal`, { params });
  }
}
