import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { OperationalDashboardDto } from '../../../../core/models/dashboard.model';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { toDateOnly, toStartOfDayIso } from '../../../../core/utils/date.util';
import { dateFromLocalKey } from '../../../../shared/components/schedule-grid/schedule-date.util';
import { EurCurrencyPipe } from '../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../shared/pipes/hr-date.pipe';

/** One backend read model per refresh. No schedule/payment/stock fan-out is used here. */
@Component({ selector: 'app-admin-dashboard', imports: [FormsModule, TranslatePipe, Button, Select, Tag, EurCurrencyPipe, HrDatePipe], templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.scss' })
export class DashboardComponent {
  protected readonly companyContext = inject(CompanyContextService);
  private readonly dashboardService = inject(DashboardService);
  readonly dashboard = signal<OperationalDashboardDto | null>(null); readonly loading = signal(false); readonly failed = signal(false);
  selectedCompanyId: string | null = this.companyContext.selectedCompanyId(); // Local calendar date (YYYY-MM-DD) - never via toISOString(), which is the UTC date.
  selectedDate = toDateOnly(new Date());
  constructor() {
    if (!this.companyContext.companies().length) this.companyContext.loadCompanies();
    // The shell switcher is shared state.  Keeping this page's local picker in
    // sync prevents a dashboard for the previously selected Company remaining
    // visible after an operator changes Company in the top bar. Dashboard has
    // no aggregate "All companies" view (the backend endpoint always needs one
    // companyId) - a switch to "All" (null) falls back to the first company,
    // same fallback reload() itself already uses, instead of being ignored and
    // leaving the previous company's dashboard on screen.
    effect(() => {
      const companyId = this.companyContext.selectedCompanyId() ?? this.companyContext.companies()[0]?.id ?? null;
      if (companyId !== this.selectedCompanyId) {
        this.selectedCompanyId = companyId;
        this.reload();
      }
    });
    queueMicrotask(() => this.reload());
  }
  onCompanyChange(companyId: string | null): void { this.selectedCompanyId = companyId; if (companyId) this.companyContext.selectCompany(companyId); this.reload(); }
  // Latest-request-wins: a slow response for a previous company/date must not replace the current one.
  private reloadToken = 0;
  reload(): void { const token = ++this.reloadToken; const companyId = this.selectedCompanyId ?? this.companyContext.selectedCompanyId() ?? this.companyContext.companies()[0]?.id; if (!companyId) { this.dashboard.set(null); this.loading.set(false); return; } this.loading.set(true); this.failed.set(false); this.dashboard.set(null); this.dashboardService.getOperational(companyId, toStartOfDayIso(dateFromLocalKey(this.selectedDate))).pipe(finalize(() => { if (token === this.reloadToken) this.loading.set(false); })).subscribe({ next: data => { if (token === this.reloadToken) this.dashboard.set(data); }, error: () => { if (token === this.reloadToken) this.failed.set(true); } }); }
  workIntervals(member: OperationalDashboardDto['staff'][number]): string { return member.workIntervals.map(x => `${x.start.slice(0, 5)}–${x.end.slice(0, 5)}`).join(', ') || '—'; }
}
