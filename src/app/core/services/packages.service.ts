import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PackageDto, PackageUpsertRequest } from '../models/package.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class PackagesService extends PagedCrudService<PackageDto, PackageUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/packages`;

  constructor(http: HttpClient) {
    super(http);
  }
}
