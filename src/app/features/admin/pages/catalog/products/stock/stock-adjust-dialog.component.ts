import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { finalize } from 'rxjs';
import { AppError } from '../../../../../../core/models/api-error.model';
import { ProductStockDto } from '../../../../../../core/models/product.model';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { StockService } from '../../../../../../core/services/stock.service';

/** The product/company pair being adjusted - a plain data object rather than
 * a full ProductDto since the caller (StockPageComponent) already has this
 * shape on hand from its joined product+stock row. */
export interface StockAdjustTarget {
  productId: string;
  productName: string;
  companyId: string;
  companyName: string;
  currentQuantity: number;
}

/**
 * Sets stock to an ABSOLUTE new quantity (StockAdjustRequest.Quantity, spec
 * section 13) - the server computes the delta and records an Adjustment (or
 * Initial, if this is the first movement for the pair). Reason is mandatory
 * (STOCK_ADJUSTMENT_REASON_REQUIRED) - validated client-side too, but the
 * backend remains authoritative so the 400 is still handled inline as a
 * fallback. No optimistic update - the emitted `adjusted` DTO is the server's
 * own response, the caller must use it to refresh state (spec section 36/43).
 */
@Component({
  selector: 'app-stock-adjust-dialog',
  imports: [Dialog, ReactiveFormsModule, InputNumber, Button, TranslatePipe],
  templateUrl: './stock-adjust-dialog.component.html',
  styleUrl: './stock-adjust-dialog.component.scss',
})
export class StockAdjustDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly stockService = inject(StockService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly target = input<StockAdjustTarget | null>(null);
  readonly adjusted = output<ProductStockDto>();

  readonly saving = signal(false);
  readonly localError = signal<string | null>(null);
  readonly dialogShown = signal(false);

  readonly delta = computed(() => {
    const target = this.target();
    if (!target) {
      return 0;
    }
    return this.form.controls.quantity.value - target.currentQuantity;
  });

  readonly form = this.fb.nonNullable.group({
    quantity: [0, [Validators.required, Validators.min(0)]],
    reason: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.localError.set(null);
        this.form.reset({ quantity: this.target()?.currentQuantity ?? 0, reason: '' });
      } else {
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onSave(): void {
    const target = this.target();
    if (!target || this.form.invalid || !this.form.controls.reason.value.trim()) {
      this.form.markAllAsTouched();
      return;
    }

    this.localError.set(null);
    this.saving.set(true);
    this.stockService
      .adjust(
        target.productId,
        target.companyId,
        { quantity: this.form.controls.quantity.value, reason: this.form.controls.reason.value.trim() },
        { suppressErrorToast: true },
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.notifications.showSuccess(this.translate.instant('STOCK.ADJUST.ADJUSTED'));
          this.visible.set(false);
          this.adjusted.emit(result);
        },
        error: (err: AppError) => {
          if (err.code === 'STOCK_ADJUSTMENT_REASON_REQUIRED') {
            this.localError.set(this.translate.instant('STOCK.ADJUST.ERRORS.REASON_REQUIRED'));
          } else {
            this.notifications.showAppError(err);
          }
        },
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
