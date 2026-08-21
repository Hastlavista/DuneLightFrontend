import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';
import { AuthService } from '../../core/auth/auth.service';
import { roleTranslationKey } from '../../core/models/role';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';
import { ADMIN_NAV_ITEMS, NavItem, TRAINER_NAV_ITEMS } from '../nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, Popover],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly router = inject(Router);

  readonly section = input.required<'admin' | 'trainer'>();
  readonly navigated = output<void>();

  readonly navItems = computed<NavItem[]>(() => {
    const items = this.section() === 'admin' ? ADMIN_NAV_ITEMS : TRAINER_NAV_ITEMS;
    const isOwner = this.currentEmployeeService.isOwner();
    return items.filter((item) => {
      if (item.ownerOnly && !isOwner) {
        return false;
      }
      return !item.requiredGrants || this.currentEmployeeService.hasAnyGrant(item.requiredGrants);
    });
  });
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

  /** Full logout - forces the plain login form on /login even if this device
   * has known users, since the person explicitly asked to leave. */
  logout(): void {
    this.endSession();
    this.router.navigate(['/login'], { queryParams: { mode: 'full' } });
  }

  /** Ends the session but leaves /login free to default to the "Odaberi
   * korisnika" chooser if this device has known users - same underlying
   * state change as logout(), only the destination view differs. */
  switchUser(): void {
    this.endSession();
    this.router.navigate(['/login']);
  }

  private endSession(): void {
    this.authService.logout();
    this.currentEmployeeService.clear();
  }
}
