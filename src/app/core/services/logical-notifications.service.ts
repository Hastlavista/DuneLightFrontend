import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LogicalNotificationDto } from '../models/logical-notification.model';
import { PagedResult } from '../models/paged-result.model';
@Injectable({ providedIn: 'root' })
export class LogicalNotificationsService {
  constructor(private readonly http: HttpClient) {}
  getForClient(clientId: string, page: number, pageSize: number) { return this.http.get<PagedResult<LogicalNotificationDto>>(`${environment.apiUrl}/api/notifications`, { params: new HttpParams().set('clientId', clientId).set('page', page).set('pageSize', pageSize) }); }
}
