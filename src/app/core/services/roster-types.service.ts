import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { RosterTypeDto, RosterTypeUpsertRequest } from '../models/roster.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class RosterTypesService extends PagedCrudService<RosterTypeDto, RosterTypeUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/roster/types`;

  constructor(http: HttpClient) {
    super(http);
  }
}
