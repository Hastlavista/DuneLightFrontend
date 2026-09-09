import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { InactivityService } from '../../../core/auth/inactivity.service';
import { KnownDeviceUser, KnownUsersService } from '../../../core/auth/known-users.service';

const PIN_PATTERN = /^\d{4,6}$/;

@Component({
  selector: 'app-pin-lock-overlay',
  imports: [ReactiveFormsModule, InputText, Button],
  templateUrl: './pin-lock-overlay.component.html',
  styleUrl: './pin-lock-overlay.component.scss',
})
export class PinLockOverlayComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly inactivity = inject(InactivityService);
  private readonly usersService = inject(KnownUsersService);
  private readonly router = inject(Router);

  readonly users = computed(() => this.usersService.forOrganization(this.auth.organizationSlug() ?? ''));
  readonly selected = signal<KnownDeviceUser | null>(this.users()[0] ?? null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly form = this.fb.nonNullable.group({ pin: ['', [Validators.required, Validators.pattern(PIN_PATTERN)]] });

  initials(user: KnownDeviceUser): string { return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase(); }

  select(user: KnownDeviceUser): void {
    this.selected.set(user);
    this.form.reset({ pin: '' });
    this.failed.set(false);
  }

  submit(): void {
    const user = this.selected();
    if (!user || this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.failed.set(false);
    this.auth.pinLogin({ organizationSlug: user.organizationSlug, email: user.email, pin: this.form.controls.pin.value })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.inactivity.unlock();
          this.router.navigate([response.role === 'Admin' ? '/admin' : '/app']);
        },
        error: () => { this.failed.set(true); this.form.reset({ pin: '' }); },
      });
  }

  useOtherAccount(): void {
    this.inactivity.stop();
    this.inactivity.locked.set(false);
    this.auth.logout();
    this.router.navigate(['/login'], { queryParams: { mode: 'full' } });
  }
}
