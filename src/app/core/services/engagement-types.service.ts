import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EngagementTypeDto, EngagementTypeUpsertRequest } from '../models/engagement-type.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class EngagementTypesService extends PagedCrudService<EngagementTypeDto, EngagementTypeUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/employees/engagement-types`;

  constructor(http: HttpClient) {
    super(http);
  }
}
