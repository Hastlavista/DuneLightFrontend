import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ClientTagDto, ClientTagUpsertRequest } from '../models/client-tag.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class ClientTagsService extends PagedCrudService<ClientTagDto, ClientTagUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/clients/tags`;

  constructor(http: HttpClient) {
    super(http);
  }
}
