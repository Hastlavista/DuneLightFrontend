import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';
import { AuthService } from '../../core/auth/auth.service';
import { InactivityService } from '../../core/auth/inactivity.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';
import { translationReadySignal } from '../../core/utils/translation-signal.util';

interface CompanyOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-topbar',
  imports: [TranslatePipe, Popover],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly inactivityService = inject(InactivityService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly translationsReady = translationReadySignal(this.translate);

  readonly titleKey = input<string | null>(null);
  readonly menuToggle = output<void>();

  readonly basePath = '/app';

  readonly user = this.authService.currentUser;
  readonly employee = this.currentEmployeeService.employee;

  readonly displayName = computed(() => {
    const employee = this.employee();
    if (employee?.hasProfile) {
      return `${employee.firstName} ${employee.lastName}`.trim();
    }
    return this.user()?.email ?? '';
  });

  readonly email = computed(() => this.user()?.email ?? '');

  readonly initials = computed(() => {
    const employee = this.employee();
    if (employee?.hasProfile) {
      // hasProfile true guarantees firstName/lastName are populated (see
      // CurrentEmployee's own doc) - TS can't infer that from a boolean flag.
      return `${employee.firstName!.charAt(0)}${employee.lastName!.charAt(0)}`.toUpperCase();
    }
    const email = this.user()?.email ?? '';
    return email.slice(0, 2).toUpperCase();
  });

  readonly avatarColor = computed(() => this.employee()?.colorHex || 'var(--brand-primary)');

  readonly companyOptions = computed<CompanyOption[]>(() => {
    this.translationsReady();
    return [
      ...(this.companyContextService.canSelectAllCompanies()
        ? [{ label: this.translate.instant('LAYOUT.TOPBAR.ALL_COMPANIES'), value: null }]
        : []),
      ...this.companyContextService.companies().map((company) => ({ label: company.name, value: company.id })),
    ];
  });

  readonly hasCompanyOptions = computed(() => this.companyOptions().length > 0);

  readonly selectedCompanyId = this.companyContextService.selectedCompanyId;

  onCompanyChange(companyId: string | null): void {
    this.companyContextService.selectCompany(companyId);
  }

  openProfile(): void {
    this.router.navigate([this.basePath, 'profile']);
  }

  logout(): void {
    this.endSession();
    this.router.navigate(['/login'], { queryParams: { mode: 'full' } });
  }

  switchUser(): void {
    // The login page owns the one shared PIN chooser. Ending this session
    // first lets its guest route render that exact component instead of a
    // visually separate overlay inside the current workspace.
    this.inactivityService.stop();
    this.endSession();
    this.router.navigate(['/login']);
  }

  private endSession(): void {
    this.authService.logout();
    this.currentEmployeeService.clear();
  }
}
