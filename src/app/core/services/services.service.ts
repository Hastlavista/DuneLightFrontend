import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyDto } from '../models/company.model';
import { ServiceDto, ServiceUpsertRequest } from '../models/service.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class ServicesService extends PagedCrudService<ServiceDto, ServiceUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/services`;

  constructor(http: HttpClient) {
    super(http);
  }

  /** GET /api/catalog/services/{serviceId}/companies - Companies this Service is
   * currently offered at, INCLUDING an inactive/grandfathered assignment (the
   * backend deliberately keeps those instead of dropping them on Company
   * deactivation - see ReplaceAssignedCompanies's doc). Empty means "offered
   * nowhere," never "offered everywhere" - Service is org-level, availability
   * per Company is entirely explicit (ServiceAvailabilityService). */
  getAssignedCompanies(serviceId: string): Observable<CompanyDto[]> {
    return this.http.get<CompanyDto[]>(`${this.resourceUrl}/${serviceId}/companies`);
  }

  /** PUT /api/catalog/services/{serviceId}/companies - atomically REPLACES the
   * whole assignment list with `companyIds` (never an incremental add/remove -
   * see ReplaceServiceCompaniesRequest's doc). An empty array is a valid,
   * intentional "offered nowhere" - not a no-op. Only NEW assignments (ids not
   * already assigned) require an active Service and an active target Company;
   * an id already assigned may stay even if either side has since gone
   * inactive (grandfathering). Returns the resulting assignment list, same
   * shape as getAssignedCompanies. */
  replaceAssignedCompanies(serviceId: string, companyIds: string[]): Observable<CompanyDto[]> {
    return this.http.put<CompanyDto[]>(`${this.resourceUrl}/${serviceId}/companies`, { companyIds });
  }
}
