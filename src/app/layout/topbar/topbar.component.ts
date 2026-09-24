import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';
import { AuthService } from '../../core/auth/auth.service';
import { InactivityService } from '../../core/auth/inactivity.service';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';

@Component({
  selector: 'app-topbar',
  imports: [TranslatePipe, Popover],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly inactivityService = inject(InactivityService);
  private readonly router = inject(Router);

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
