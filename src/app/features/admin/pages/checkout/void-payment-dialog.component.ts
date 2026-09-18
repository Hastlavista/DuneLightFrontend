import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { finalize } from 'rxjs';
import { PaymentDto } from '../../../../core/models/appointment.model';
import { CheckoutDto } from '../../../../core/models/checkout.model';
import { CheckoutsService } from '../../../../core/services/checkouts.service';
import { NotificationService } from '../../../../core/services/notification.service';

/** Manual Payment void (spec sections 30-31) - a non-empty `reason` is
 * required at runtime by the backend (PAYMENT_VOID_REASON_REQUIRED), enforced
 * here client-side too for immediate feedback. Only reachable while the
 * Checkout is Open (see CheckoutDetailComponent's button guard) - the row
 * itself is never removed, only its status/void fields change once this
 * succeeds. */
@Component({
  selector: 'app-void-payment-dialog',
  imports: [ReactiveFormsModule, TranslatePipe, Dialog, Button],
  templateUrl: './void-payment-dialog.component.html',
})
export class VoidPaymentDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly checkoutsService = inject(CheckoutsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly checkout = input.required<CheckoutDto>();
  readonly payment = input<PaymentDto | null>(null);
  readonly saved = output<CheckoutDto>();

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ reason: '' });
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payment = this.payment();
    if (!payment) {
      return;
    }

    this.saving.set(true);
    this.checkoutsService
      .voidPayment(this.checkout().id, payment.id, { reason: this.form.getRawValue().reason })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.notifications.showSuccess(this.translate.instant('CHECKOUT.VOID_PAYMENT.VOIDED'));
          this.visible.set(false);
          this.saved.emit(updated);
        },
        error: () => {},
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
