import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { roleTranslationKey } from '../../core/models/role';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';
import { ADMIN_NAV_ITEMS, NavItem, TRAINER_NAV_ITEMS } from '../nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly router = inject(Router);

  readonly section = input.required<'admin' | 'trainer'>();
  readonly navigated = output<void>();

  readonly navItems = computed<NavItem[]>(() =>
    this.section() === 'admin' ? ADMIN_NAV_ITEMS : TRAINER_NAV_ITEMS,
  );
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

  readonly initials = computed(() => {
    const employee = this.employee();
    if (employee) {
      return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
    }
    const email = this.user()?.email ?? '';
    return email.slice(0, 2).toUpperCase();
  });

  readonly roleLabelKey = computed(() => {
    const role = this.user()?.role;
    return role ? roleTranslationKey(role) : '';
  });

  readonly avatarColor = computed(() => this.employee()?.colorHex || 'var(--gold)');

  onNavigate(): void {
    this.navigated.emit();
  }

  logout(): void {
    this.authService.logout();
    this.currentEmployeeService.clear();
    this.router.navigate(['/login']);
  }
}
