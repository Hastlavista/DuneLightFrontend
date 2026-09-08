import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CompanyDto, CompanyUpsertRequest } from '../models/company.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class CompaniesService extends PagedCrudService<CompanyDto, CompanyUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/companies`;

  constructor(http: HttpClient) {
    super(http);
  }
}
