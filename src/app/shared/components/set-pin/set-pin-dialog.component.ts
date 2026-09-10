import { Component, inject, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/models/api-error.model';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { resolveErrorMessage } from '../../../core/utils/error-translation.util';

const PIN_PATTERN = /^\d{4,6}$/;

/**
 * "Postavi PIN" modal - same POST /api/public/Auth/ChangePin call as
 * ProfileComponent's own PIN form (see its doc comment), just packaged as a
 * standalone dialog so SetPinCtaComponent can drop it onto any page without
 * duplicating the form. On success refreshes CurrentEmployeeService so
 * hasPinSet flips immediately, which is what makes the CTA banner that opened
 * this dialog disappear on its own.
 */
@Component({
  selector: 'app-set-pin-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, Password, Button, TranslatePipe],
  templateUrl: './set-pin-dialog.component.html',
})
export class SetPinDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly completed = output<void>();

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    newPin: ['', [Validators.required, Validators.pattern(PIN_PATTERN)]],
    currentPassword: ['', Validators.required],
  });

  onDialogHide(): void {
    this.errorMessage.set(null);
    this.form.reset({ newPin: '', currentPassword: '' });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.saving.set(true);
    const raw = this.form.getRawValue();

    this.authService
      .changePin({ currentPassword: raw.currentPassword, newPin: raw.newPin })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.currentEmployeeService.load().subscribe(() => {
            this.notifications.showSuccess(this.translate.instant('SET_PIN.SAVED'));
            this.visible.set(false);
            this.completed.emit();
          });
        },
        error: (err: AppError) => {
          this.errorMessage.set(resolveErrorMessage(this.translate, err.code));
        },
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
