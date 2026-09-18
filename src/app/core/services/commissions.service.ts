import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommissionEntriesResult, CommissionEntryDto, CommissionRuleDto, CommissionRuleRequest, CommissionSummaryResultDto } from '../models/commission.model';

@Injectable({ providedIn: 'root' })
export class CommissionsService {
  private readonly baseUrl = `${environment.apiUrl}/api/commissions`;
  constructor(private readonly http: HttpClient) {}
  getRules(query: { employeeId?: string; subjectType?: string; isActive?: boolean }) { return this.http.get<CommissionRuleDto[]>(`${this.baseUrl}/rules`, { params: this.params(query) }); }
  createRule(request: CommissionRuleRequest) { return this.http.post<CommissionRuleDto>(`${this.baseUrl}/rules`, request); }
  updateRule(id: string, request: Pick<CommissionRuleRequest, 'calculationType' | 'value'>) { return this.http.put<CommissionRuleDto>(`${this.baseUrl}/rules/${id}`, request); }
  activateRule(id: string) { return this.http.patch<CommissionRuleDto>(`${this.baseUrl}/rules/${id}/activate`, null); }
  deactivateRule(id: string) { return this.http.patch<CommissionRuleDto>(`${this.baseUrl}/rules/${id}/deactivate`, null); }
  getEntries(query: Record<string, string | number | undefined>) { return this.http.get<CommissionEntriesResult>(`${this.baseUrl}/entries`, { params: this.params(query) }); }
  getSummary(query: Record<string, string | undefined>) { return this.http.get<CommissionSummaryResultDto>(`${this.baseUrl}/summary`, { params: this.params(query) }); }
  private params(query: Record<string, string | number | boolean | undefined>): HttpParams { return Object.entries(query).reduce((p, [key, value]) => value === undefined || value === '' ? p : p.set(key, value), new HttpParams()); }
}
