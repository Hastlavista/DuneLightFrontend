import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/models/api-error.model';
import { resolveErrorMessage } from '../../../core/utils/error-translation.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, InputText, Password, Button, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    organizationSlug: [this.authService.getRememberedOrganizationSlug(), Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
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
}
