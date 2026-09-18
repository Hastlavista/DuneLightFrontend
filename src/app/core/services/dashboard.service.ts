import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { OperationalDashboardDto } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}
  getOperational(companyId: string, date: string) {
    return this.http.get<OperationalDashboardDto>(`${environment.apiUrl}/api/dashboard/operational`, { params: new HttpParams().set('companyId', companyId).set('date', date) });
  }
}
