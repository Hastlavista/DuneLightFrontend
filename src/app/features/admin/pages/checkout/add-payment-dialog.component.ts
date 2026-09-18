import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { SelectButton } from 'primeng/selectbutton';
import { finalize } from 'rxjs';
import { PAYMENT_METHODS, PaymentMethod, paymentMethodTranslationKey } from '../../../../core/models/appointment.model';
import { CheckoutDto, CheckoutPaymentCreateRequest } from '../../../../core/models/checkout.model';
import { CheckoutsService } from '../../../../core/services/checkouts.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { translationReadySignal } from '../../../../core/utils/translation-signal.util';

interface PaymentMethodOption {
  label: string;
  value: PaymentMethod;
}

/**
 * "Add payment" dialog (spec sections 19-21) - supports partial/split
 * payment by simply being reopened for each installment (Cash 30, then Card
 * 70, ...), each call is its own Payment row. `allocations` is always
 * omitted on the request so the backend allocates FIFO automatically across
 * items with an outstanding balance - the MVP UI never exposes manual
 * per-item allocation (spec section 20's documented choice). Amount is
 * pre-filled with (and softly capped to) the current outstanding balance,
 * but the backend remains the authority on overpayment
 * (PAYMENT_EXCEEDS_OUTSTANDING_AMOUNT).
 */
@Component({
  selector: 'app-add-payment-dialog',
  imports: [ReactiveFormsModule, TranslatePipe, Dialog, InputNumber, SelectButton, Button],
  templateUrl: './add-payment-dialog.component.html',
})
export class AddPaymentDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly checkoutsService = inject(CheckoutsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly checkout = input.required<CheckoutDto>();
  readonly saved = output<CheckoutDto>();

  readonly saving = signal(false);
  private readonly translationsReady = translationReadySignal(this.translate);
  readonly paymentMethodOptions = computed<PaymentMethodOption[]>(() => {
    this.translationsReady();
    return PAYMENT_METHODS.map((method) => ({ label: this.translate.instant(paymentMethodTranslationKey(method)), value: method }));
  });

  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: this.fb.nonNullable.control<PaymentMethod>('Cash', Validators.required),
    note: [''],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ amount: this.checkout().totals.outstandingAmount, method: 'Cash', note: '' });
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: CheckoutPaymentCreateRequest = {
      amount: raw.amount,
      method: raw.method,
      note: raw.note || undefined,
    };

    this.saving.set(true);
    this.checkoutsService
      .recordPayment(this.checkout().id, request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.notifications.showSuccess(this.translate.instant('CHECKOUT.ADD_PAYMENT.PAID'));
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
