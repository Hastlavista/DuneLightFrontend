import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ServiceDto, ServiceUpsertRequest } from '../models/service.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class ServicesService extends PagedCrudService<ServiceDto, ServiceUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/services`;

  constructor(http: HttpClient) {
    super(http);
  }
}
