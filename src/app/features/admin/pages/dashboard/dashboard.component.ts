import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { OperationalDashboardDto } from '../../../../core/models/dashboard.model';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { EurCurrencyPipe } from '../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../shared/pipes/hr-date.pipe';

/** One backend read model per refresh. No schedule/payment/stock fan-out is used here. */
@Component({ selector: 'app-admin-dashboard', imports: [FormsModule, Button, Select, Tag, EurCurrencyPipe, HrDatePipe], templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.scss' })
export class DashboardComponent {
  protected readonly companyContext = inject(CompanyContextService);
  private readonly dashboardService = inject(DashboardService);
  readonly dashboard = signal<OperationalDashboardDto | null>(null); readonly loading = signal(false); readonly failed = signal(false);
  selectedCompanyId: string | null = this.companyContext.selectedCompanyId(); selectedDate = new Date().toISOString().slice(0, 10);
  constructor() {
    if (!this.companyContext.companies().length) this.companyContext.loadCompanies();
    // The shell switcher is shared state.  Keeping this page's local picker in
    // sync prevents a dashboard for the previously selected Company remaining
    // visible after an operator changes Company in the top bar.
    effect(() => {
      const companyId = this.companyContext.selectedCompanyId();
      if (companyId && companyId !== this.selectedCompanyId) {
        this.selectedCompanyId = companyId;
        this.reload();
      }
    });
    queueMicrotask(() => this.reload());
  }
  onCompanyChange(companyId: string | null): void { this.selectedCompanyId = companyId; if (companyId) this.companyContext.selectCompany(companyId); this.reload(); }
  reload(): void { const companyId = this.selectedCompanyId ?? this.companyContext.selectedCompanyId() ?? this.companyContext.companies()[0]?.id; if (!companyId) { this.dashboard.set(null); return; } this.loading.set(true); this.failed.set(false); this.dashboard.set(null); this.dashboardService.getOperational(companyId, `${this.selectedDate}T00:00:00.000Z`).pipe(finalize(() => this.loading.set(false))).subscribe({ next: data => this.dashboard.set(data), error: () => this.failed.set(true) }); }
  workIntervals(member: OperationalDashboardDto['staff'][number]): string { return member.workIntervals.map(x => `${x.start.slice(0, 5)}–${x.end.slice(0, 5)}`).join(', ') || '—'; }
}
