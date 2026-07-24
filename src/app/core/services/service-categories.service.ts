import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ServiceCategoryDto, ServiceCategoryUpsertRequest } from '../models/service-category.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class ServiceCategoriesService extends PagedCrudService<ServiceCategoryDto, ServiceCategoryUpsertRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/service-categories`;

  constructor(http: HttpClient) {
    super(http);
  }
}
