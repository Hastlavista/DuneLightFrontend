import { afterNextRender, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { finalize, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { InactivityService } from '../../../core/auth/inactivity.service';
import { KnownDeviceUser, KnownUsersService } from '../../../core/auth/known-users.service';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';

const PIN_PATTERN = /^\d{4,6}$/;

@Component({
  selector: 'app-pin-lock-overlay',
  imports: [ReactiveFormsModule, InputText, Button],
  templateUrl: './pin-lock-overlay.component.html',
  styleUrl: './pin-lock-overlay.component.scss',
})
export class PinLockOverlayComponent {
  /** Renders the same PIN flow as a normal login page instead of a screen lock. */
  readonly standalone = input(false);
  readonly pinDots = [0, 1, 2, 3, 4, 5];
  readonly pinInput = viewChild<ElementRef<HTMLInputElement>>('pinInput');

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly inactivity = inject(InactivityService);
  private readonly usersService = inject(KnownUsersService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly router = inject(Router);

  readonly users = computed(() =>
    this.usersService.forOrganization(this.auth.organizationSlug() ?? this.auth.getRememberedOrganizationSlug()),
  );
  readonly selected = signal<KnownDeviceUser | null>(this.users()[0] ?? null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly form = this.fb.nonNullable.group({ pin: ['', [Validators.required, Validators.pattern(PIN_PATTERN)]] });

  constructor() {
    afterNextRender(() => this.focusPinInput());
  }

  initials(user: KnownDeviceUser): string { return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase(); }

  select(user: KnownDeviceUser): void {
    this.selected.set(user);
    this.form.reset({ pin: '' });
    this.failed.set(false);
    queueMicrotask(() => this.focusPinInput());
  }

  private focusPinInput(): void {
    this.pinInput()?.nativeElement.focus();
  }

  submit(): void {
    const user = this.selected();
    if (!user || this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.failed.set(false);
    this.auth.pinLogin({ organizationSlug: user.organizationSlug, email: user.email, pin: this.form.controls.pin.value })
      .pipe(
        // A route can be reused when an Admin switches to another Admin on the
        // dashboard. Load the new employee before unmasking that existing
        // shell, otherwise its navigation signals still describe the previous
        // user until a browser refresh.
        switchMap(() => {
          this.currentEmployeeService.clear();
          return this.currentEmployeeService.load();
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => {
          this.inactivity.unlock();
          this.router.navigate(['/app']);
        },
        error: () => { this.failed.set(true); this.form.reset({ pin: '' }); },
      });
  }

  useOtherAccount(): void {
    if (!this.standalone()) {
      this.inactivity.stop();
      this.inactivity.locked.set(false);
      this.auth.logout();
      this.currentEmployeeService.clear();
    }
    this.router.navigate(['/login'], { queryParams: { mode: 'full' } });
  }
}
