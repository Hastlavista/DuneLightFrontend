import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { KnownDeviceUser, KnownUsersService } from '../../../core/auth/known-users.service';
import { AppError } from '../../../core/models/api-error.model';
import { resolveErrorMessage } from '../../../core/utils/error-translation.util';

const PIN_PATTERN = /^\d{4,6}$/;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, InputText, Password, Button, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly knownUsersService = inject(KnownUsersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly confirmationService = inject(ConfirmationService);

  /** "Odjava" (sidebar) links here with ?mode=full to force the plain login
   * form even when this device has known users - see SidebarComponent.logout(). */
  private readonly forcedFullForm = signal(this.route.snapshot.queryParamMap.get('mode') === 'full');

  /** Known users for whichever organization was last used on this device -
   * getRememberedOrganizationSlug() also drives the org field prefill below,
   * so both stay in sync with "the org this device was last used for". */
  readonly knownUsers = computed<KnownDeviceUser[]>(() =>
    this.knownUsersService.forOrganization(this.authService.getRememberedOrganizationSlug()),
  );

  readonly showChooser = computed(() => !this.forcedFullForm() && this.knownUsers().length > 0);

  readonly selectedUser = signal<KnownDeviceUser | null>(null);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    organizationSlug: [this.authService.getRememberedOrganizationSlug(), Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly pinLoading = signal(false);
  readonly pinErrorMessage = signal<string | null>(null);
  readonly pinForm = this.fb.nonNullable.group({
    pin: ['', [Validators.required, Validators.pattern(PIN_PATTERN)]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.router.navigate([response.role === 'Admin' ? '/admin' : '/app']);
        },
        error: (err: AppError) => {
          this.errorMessage.set(resolveErrorMessage(this.translate, err.code));
        },
      });
  }

  selectUser(user: KnownDeviceUser): void {
    this.selectedUser.set(user);
    this.pinForm.reset({ pin: '' });
    this.pinErrorMessage.set(null);
  }

  cancelPin(): void {
    this.selectedUser.set(null);
  }

  initialsFor(user: KnownDeviceUser): string {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }

  colorFor(user: KnownDeviceUser): string {
    return user.colorHex || 'var(--gold)';
  }

  submitPin(): void {
    const user = this.selectedUser();
    if (!user) {
      return;
    }
    if (this.pinForm.invalid) {
      this.pinForm.markAllAsTouched();
      return;
    }

    this.pinLoading.set(true);
    this.pinErrorMessage.set(null);

    this.authService
      .pinLogin({ organizationSlug: user.organizationSlug, email: user.email, pin: this.pinForm.getRawValue().pin })
      .pipe(finalize(() => this.pinLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.router.navigate([response.role === 'Admin' ? '/admin' : '/app']);
        },
        error: (err: AppError) => {
          // AUTH_INVALID_PIN is deliberately generic (wrong PIN, unknown
          // email, or no PIN set all collapse to the same backend code) -
          // resolveErrorMessage just surfaces its translation as-is, no
          // per-cause branching here.
          this.pinErrorMessage.set(resolveErrorMessage(this.translate, err.code));
        },
      });
  }

  removeUser(user: KnownDeviceUser, event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('AUTH.PIN_LOGIN.CONFIRM_REMOVE', {
        name: `${user.firstName} ${user.lastName}`.trim(),
      }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.knownUsersService.forget(user.email, user.organizationSlug);
        const selected = this.selectedUser();
        if (selected && selected.email === user.email && selected.organizationSlug === user.organizationSlug) {
          this.selectedUser.set(null);
        }
      },
    });
  }

  showFullLogin(): void {
    this.forcedFullForm.set(true);
    this.selectedUser.set(null);
  }

  showChooserAgain(): void {
    this.forcedFullForm.set(false);
  }
}
