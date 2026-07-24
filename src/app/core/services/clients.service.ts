import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BirthdayDto, ClientDto, ClientUpsertRequest } from '../models/client.model';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { PlusSafeUrlCodec } from '../http/plus-safe-url-codec';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class ClientsService extends PagedCrudService<ClientDto, ClientUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/clients`;

  constructor(http: HttpClient) {
    super(http);
  }

  /** GET /api/clients/next-member-number - a bare int, no envelope. Advisory
   * only: it prefills the "broj člana" field on the new-client form, the user
   * can still change it and uniqueness is (re)checked on save
   * (DUPLICATE_MEMBER_NUMBER, 409). */
  getNextMemberNumber(): Observable<number> {
    return this.http.get<number>(`${this.resourceUrl}/next-member-number`, {
      context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
    });
  }

  /** GET /api/clients/birthdays?from=&to= - a flat array, not a PagedResult.
   * `from`/`to` are required DateTimeOffset strings (see core/utils/date.util.ts). */
  getBirthdays(from: string, to: string): Observable<BirthdayDto[]> {
    const params = new HttpParams({ encoder: new PlusSafeUrlCodec() }).set('from', from).set('to', to);
    return this.http.get<BirthdayDto[]>(`${this.resourceUrl}/birthdays`, { params });
  }

  /** POST /api/clients/{id}/anonymize - GDPR "right to be forgotten". Irreversible;
   * see AnonymizeClientDialogComponent for the confirmation UX this requires. */
  anonymize(id: string): Observable<ClientDto> {
    return this.http.post<ClientDto>(`${this.resourceUrl}/${id}/anonymize`, null);
  }
}
