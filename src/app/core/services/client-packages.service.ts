import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlusSafeUrlCodec } from '../http/plus-safe-url-codec';
import { ClientPackageDto, ClientPackagePurchaseRequest } from '../models/client-package.model';

/** Packages sold to a given client - nested under /api/clients/{clientId}/packages,
 * not a standalone šifrarnik (no paging, no activate/deactivate/delete), so this
 * doesn't extend PagedCrudService. */
@Injectable({ providedIn: 'root' })
export class ClientPackagesService {
  private readonly resourceUrl = `${environment.apiUrl}/api/clients`;

  constructor(private readonly http: HttpClient) {}

  getForClient(clientId: string): Observable<ClientPackageDto[]> {
    return this.http.get<ClientPackageDto[]>(`${this.resourceUrl}/${clientId}/packages`);
  }

  issue(clientId: string, request: ClientPackagePurchaseRequest): Observable<ClientPackageDto> {
    return this.http.post<ClientPackageDto>(`${this.resourceUrl}/${clientId}/packages`, request);
  }

  /** GET /api/clients/{clientId}/packages/eligible?serviceId=&date= - the same
   * eligibility decision the server applies internally when auto-resolving
   * coverage (see SetGroupAttendanceRequest/CoverageType), already filtered and
   * sorted by expiry date. `date` is optional (omit for "now"); pass the
   * occurrence's own date when checking attendance for a past appointment, so
   * a package that has since expired isn't offered. Shared between Grupe's
   * attendance modal and individual termini's (once built) - don't duplicate
   * this call or its eligibility rule elsewhere. */
  getEligible(clientId: string, serviceId: string, date?: string): Observable<ClientPackageDto[]> {
    let params = new HttpParams({ encoder: new PlusSafeUrlCodec() }).set('serviceId', serviceId);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<ClientPackageDto[]>(`${this.resourceUrl}/${clientId}/packages/eligible`, { params });
  }
}
