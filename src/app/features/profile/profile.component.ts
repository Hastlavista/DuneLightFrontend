import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Password } from 'primeng/password';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AppError } from '../../core/models/api-error.model';
import { roleTranslationKey } from '../../core/models/role';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';
import { NotificationService } from '../../core/services/notification.service';
import { resolveErrorMessage } from '../../core/utils/error-translation.util';

/** Group-level: only checked once both fields have a value, so the per-field
 * "min 8 znakova" error on newPassword isn't drowned out while still typing. */
function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value as string;
  const confirmPassword = group.get('confirmPassword')?.value as string;
  return newPassword && confirmPassword && newPassword !== confirmPassword ? { mismatch: true } : null;
}

/**
 * "Moj profil" - shared as-is between /admin/profile and /app/profile (see
 * admin.routes.ts / trainer.routes.ts), since there's nothing role-specific
 * about it: read-only identity info from CurrentEmployeeService plus a change-
 * password form against the already-existing AuthService.changePassword().
 * The error interceptor already routes /api/public/Auth/* failures away from
 * the global toast (see error.interceptor.ts's AUTH_ROUTE_PATTERN), so
 * AUTH_CURRENT_PASSWORD_INVALID is handled inline here, same convention as
 * LoginComponent's errorMessage.
 */
@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, Password, Button, TranslatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly employee = this.currentEmployeeService.employee;
  readonly user = this.authService.currentUser;

  readonly displayName = computed(() => {
    const employee = this.employee();
    return employee ? `${employee.firstName} ${employee.lastName}`.trim() : (this.user()?.email ?? '');
  });

  readonly roleLabelKey = computed(() => {
    const role = this.user()?.role;
    return role ? roleTranslationKey(role) : '';
  });

  readonly locationNames = computed(() => this.employee()?.locations.map((location) => location.locationName) ?? []);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [passwordsMatchValidator] },
  );

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.saving.set(true);
    const raw = this.form.getRawValue();

    this.authService
      .changePassword({ currentPassword: raw.currentPassword, newPassword: raw.newPassword })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('PROFILE.SUCCESS'));
          this.form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
        },
        error: (err: AppError) => {
          this.errorMessage.set(resolveErrorMessage(this.translate, err.code));
        },
      });
  }
}
