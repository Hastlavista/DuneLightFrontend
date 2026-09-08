import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { RoomDto, RoomUpsertRequest } from '../models/room.model';
import { PagedCrudService } from './paged-crud.service';

/** Prostorije - a Company-scoped šifrarnik, same paged-CRUD shape as
 * ServicesService/CompaniesService. Filter by owner via getPage's
 * `extraParams: { companyId }` (see RoomsTabComponent), not a nested route. */
@Injectable({ providedIn: 'root' })
export class RoomsService extends PagedCrudService<RoomDto, RoomUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/rooms`;

  constructor(http: HttpClient) {
    super(http);
  }
}
