import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlusSafeUrlCodec } from '../http/plus-safe-url-codec';
import {
  EffectivePriceRow,
  PriceListCreateRequest,
  PriceListItemDto,
  PriceListSubjectType,
  PriceListUpdateRequest,
  ResolvePriceResult,
} from '../models/price-list.model';
import { PagedCrudService } from './paged-crud.service';

@Injectable({ providedIn: 'root' })
export class PriceListService extends PagedCrudService<PriceListItemDto, PriceListCreateRequest> {
  protected readonly resourceUrl = `${environment.apiUrl}/api/catalog/price-list`;

  constructor(http: HttpClient) {
    super(http);
  }

  /** Update only ever touches price + validity period - subject/location are
   * immutable after creation (see PriceListUpdateRequest), so this narrows the
   * base class's create/update pair instead of reusing PriceListCreateRequest. */
  override update(id: string, request: PriceListUpdateRequest): Observable<PriceListItemDto> {
    return this.http.put<PriceListItemDto>(`${this.resourceUrl}/${id}`, request);
  }

  getEffective(locationId: string, date: string): Observable<EffectivePriceRow[]> {
    const params = new HttpParams({ encoder: new PlusSafeUrlCodec() })
      .set('locationId', locationId)
      .set('date', date);
    return this.http.get<EffectivePriceRow[]>(`${this.resourceUrl}/effective`, { params });
  }

  resolve(query: {
    subjectType: PriceListSubjectType;
    subjectId: string;
    locationId: string;
    date: string;
  }): Observable<ResolvePriceResult> {
    const params = new HttpParams({ encoder: new PlusSafeUrlCodec() })
      .set('subjectType', query.subjectType)
      .set('subjectId', query.subjectId)
      .set('locationId', query.locationId)
      .set('date', query.date);
    return this.http.get<ResolvePriceResult>(`${this.resourceUrl}/resolve`, { params });
  }
}
