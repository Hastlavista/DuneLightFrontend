import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { AppError } from '../../../../../../core/models/api-error.model';
import { StudioCompany } from '../../../../../../core/models/company.model';
import { StockTransferResultDto } from '../../../../../../core/models/product.model';
import { CompanyContextService } from '../../../../../../core/services/company-context.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { StockService } from '../../../../../../core/services/stock.service';

export interface StockTransferSource {
  productId: string;
  productName: string;
  companyId: string;
  companyName: string;
  currentQuantity: number;
}

/**
 * One atomic transfer between two Companies (StockTransferRequest, spec
 * section 18) - implemented as a single POST /api/stock/transfers call, never
 * as two separate adjust() calls from the frontend. Reuses
 * CompanyContextService's already-loaded company list for the destination
 * picker (spec section 41 - no duplicate Company data source) rather than
 * fetching its own. Quantity=0 is rejected client-side too (StockTransferRequest.Quantity
 * has [Range(1, ...)] server-side) - distinct from stock adjustment, where 0
 * is a perfectly valid absolute quantity.
 */
@Component({
  selector: 'app-stock-transfer-dialog',
  imports: [Dialog, ReactiveFormsModule, InputNumber, Select, Button, TranslatePipe],
  templateUrl: './stock-transfer-dialog.component.html',
  styleUrl: './stock-transfer-dialog.component.scss',
})
export class StockTransferDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly stockService = inject(StockService);
  protected readonly companyContextService = inject(CompanyContextService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly source = input<StockTransferSource | null>(null);
  readonly transferred = output<StockTransferResultDto>();
  /** Fires on INSUFFICIENT_STOCK with the server's authoritative "available"
   * count (from the error's details, spec section 21) so the caller can patch
   * its source row instead of leaving a stale quantity on screen while the
   * dialog itself stays open for the user to retry with a lower amount. */
  readonly sourceQuantityChanged = output<number>();

  readonly saving = signal(false);
  readonly localError = signal<string | null>(null);
  readonly dialogShown = signal(false);

  readonly destinationOptions = computed<StudioCompany[]>(() => {
    const source = this.source();
    return this.companyContextService.companies().filter((company) => company.id !== source?.companyId);
  });

  readonly form = this.fb.nonNullable.group({
    destinationCompanyId: this.fb.nonNullable.control<string | null>(null, Validators.required),
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.localError.set(null);
        this.form.reset({ destinationCompanyId: null, quantity: 1 });
      } else {
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onSave(): void {
    const source = this.source();
    if (!source || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const destinationCompanyId = this.form.controls.destinationCompanyId.value;
    if (!destinationCompanyId) {
      return;
    }

    this.localError.set(null);
    this.saving.set(true);
    this.stockService
      .transfer(
        {
          productId: source.productId,
          fromCompanyId: source.companyId,
          toCompanyId: destinationCompanyId,
          quantity: this.form.controls.quantity.value,
        },
        { suppressErrorToast: true },
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.notifications.showSuccess(this.translate.instant('STOCK.TRANSFER.TRANSFERRED'));
          this.visible.set(false);
          this.transferred.emit(result);
        },
        error: (err: AppError) => {
          if (err.code === 'INSUFFICIENT_STOCK') {
            const details = err.details as unknown as { available?: number; requested?: number } | undefined;
            this.localError.set(
              details?.available !== undefined
                ? this.translate.instant('errors.INSUFFICIENT_STOCK') + ` (${details.available})`
                : this.translate.instant('errors.INSUFFICIENT_STOCK'),
            );
            if (details?.available !== undefined) {
              this.sourceQuantityChanged.emit(details.available);
            }
          } else if (err.code === 'TRANSFER_SAME_COMPANY') {
            this.localError.set(this.translate.instant('errors.TRANSFER_SAME_COMPANY'));
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
