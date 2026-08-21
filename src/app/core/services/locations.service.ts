import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LocationDto, LocationUpsertRequest } from '../models/location.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class LocationsService extends PagedCrudService<LocationDto, LocationUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/companies`;

  constructor(http: HttpClient) {
    super(http);
  }
}
