import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/models/api-error.model';
import { resolveErrorMessage } from '../../../core/utils/error-translation.util';

/**
 * "Otvorite organizaciju" - POST /api/public/Auth/Register, creates a brand
 * new Organization plus its Owner user in one step and logs them straight in
 * (see AuthService.register - same AuthResponse shape as login, already a
 * valid session). Reachable only from the login screen's own link (see
 * LoginComponent) - not yet in any nav, per the initial ask ("gumb bude na
 * login ekranu zasada").
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, InputText, Password, Button, TranslatePipe],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    organizationName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .register(this.form.getRawValue())
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
}
