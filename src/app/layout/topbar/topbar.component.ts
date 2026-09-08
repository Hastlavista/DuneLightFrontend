import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';

interface CompanyOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, Popover],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly companyContextService = inject(CompanyContextService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly section = input.required<'admin' | 'trainer'>();
  readonly titleKey = input<string | null>(null);
  readonly menuToggle = output<void>();

  readonly isAdmin = computed(() => this.authService.currentRole() === 'Admin');
  readonly basePath = computed(() => (this.section() === 'admin' ? '/admin' : '/app'));

  readonly user = this.authService.currentUser;
  readonly employee = this.currentEmployeeService.employee;

  readonly displayName = computed(() => {
    const employee = this.employee();
    if (employee) {
      return `${employee.firstName} ${employee.lastName}`.trim();
    }
    return this.user()?.email ?? '';
  });

  readonly email = computed(() => this.user()?.email ?? '');

  readonly initials = computed(() => {
    const employee = this.employee();
    if (employee) {
      return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
    }
    const email = this.user()?.email ?? '';
    return email.slice(0, 2).toUpperCase();
  });

  readonly avatarColor = computed(() => this.employee()?.colorHex || 'var(--teal)');

  readonly companyOptions = computed<CompanyOption[]>(() => [
    { label: this.translate.instant('LAYOUT.TOPBAR.ALL_COMPANIES'), value: null },
    ...this.companyContextService
      .companies()
      .map((company) => ({ label: company.name, value: company.id })),
  ]);

  readonly selectedCompanyId = this.companyContextService.selectedCompanyId;

  onCompanyChange(companyId: string | null): void {
    this.companyContextService.selectCompany(companyId);
  }

  openProfile(): void {
    this.router.navigate([this.basePath(), 'profile']);
  }

  openAccountSettings(): void {
    this.openProfile();
  }

  logout(): void {
    this.endSession();
    this.router.navigate(['/login'], { queryParams: { mode: 'full' } });
  }

  switchUser(): void {
    this.endSession();
    this.router.navigate(['/login']);
  }

  private endSession(): void {
    this.authService.logout();
    this.currentEmployeeService.clear();
  }
}
