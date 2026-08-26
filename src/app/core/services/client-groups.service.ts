import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientGroupMembershipDto } from '../models/group.model';

/** Groups a given client is a member of, active and historical - nested under
 * /api/clients/{clientId}/groups, not a standalone šifrarnik (no paging), so
 * this doesn't extend PagedCrudService. Feeds the client detail page's Termini
 * tab (see ClientAppointmentsTabComponent). */
@Injectable({ providedIn: 'root' })
export class ClientGroupsService {
  private readonly resourceUrl = `${environment.apiUrl}/api/clients`;

  constructor(private readonly http: HttpClient) {}

  getForClient(clientId: string): Observable<ClientGroupMembershipDto[]> {
    return this.http.get<ClientGroupMembershipDto[]>(`${this.resourceUrl}/${clientId}/groups`);
  }
}
