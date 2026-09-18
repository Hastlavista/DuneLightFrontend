import { Component, inject, input, model, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { StockMovementDto, StockMovementType } from '../../../../../../core/models/product.model';
import { StockService } from '../../../../../../core/services/stock.service';

const MOVEMENT_SEVERITY: Record<StockMovementType, 'success' | 'danger' | 'info' | 'warn' | 'secondary'> = {
  Initial: 'info',
  Adjustment: 'secondary',
  Sale: 'danger',
  SaleReversal: 'warn',
  TransferOut: 'warn',
  TransferIn: 'success',
};

/**
 * Read-only audit history for one Product's stock (GET
 * /api/stock/product/{productId}/movements, grant stock.view) - immutable,
 * no edit/delete affordance anywhere here (spec section 26/29). The endpoint
 * is not Company-filtered so movements from every Company the Product has
 * ever touched show up together; the Company column disambiguates. Sale rows
 * only carry a CheckoutItemId (no deep link exists into Checkout from here),
 * shown as a plain reference label rather than a clickable link (spec
 * section 24/52 - only render fields the DTO actually exposes).
 */
@Component({
  selector: 'app-stock-movements-dialog',
  imports: [Dialog, TableModule, Tag, TranslatePipe],
  templateUrl: './stock-movements-dialog.component.html',
  styleUrl: './stock-movements-dialog.component.scss',
})
export class StockMovementsDialogComponent {
  private readonly stockService = inject(StockService);

  readonly visible = model(false);
  readonly productId = input<string | null>(null);
  readonly productName = input<string>('');

  readonly loading = signal(false);
  readonly movements = signal<StockMovementDto[]>([]);

  severityFor(type: StockMovementType): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
    return MOVEMENT_SEVERITY[type];
  }

  onDialogShow(): void {
    const productId = this.productId();
    if (!productId) {
      return;
    }
    this.loading.set(true);
    this.movements.set([]);
    this.stockService
      .getMovements(productId, { suppressErrorToast: true })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((movements) => this.movements.set(movements));
  }

  onClose(): void {
    this.visible.set(false);
  }

  /** "23.07.2026. 17:00" - same local construction as
   * AddCheckoutItemDialogComponent.dateTimeLabel (no shared date+time pipe
   * exists yet in this app, only HrDatePipe's date-only format). */
  dateTimeLabel(value: string): string {
    const date = new Date(value);
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}. ${time}`;
  }
}
