import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import {
  CheckoutDto,
  CheckoutItemDto,
  checkoutItemTypeIcon,
  checkoutItemTypeTranslationKey,
  checkoutStatusSeverity,
  checkoutStatusTranslationKey,
  paymentStatusSeverity,
  paymentStatusTranslationKey,
} from '../../../../core/models/checkout.model';
import { PaymentDto, paymentMethodTranslationKey } from '../../../../core/models/appointment.model';
import { CheckoutsService } from '../../../../core/services/checkouts.service';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EurCurrencyPipe } from '../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../shared/pipes/hr-date.pipe';
import { AddCheckoutItemDialogComponent } from './add-checkout-item-dialog.component';
import { AddPaymentDialogComponent } from './add-payment-dialog.component';
import { VoidPaymentDialogComponent } from './void-payment-dialog.component';

/**
 * Main operational POS view (route 'checkout/:id') - header, items,
 * financial summary, payments and the Add item/Add payment/Complete/Cancel
 * actions (spec section 11). Always re-renders from the fresh CheckoutDto
 * every mutating dialog/action returns instead of hand-patching local state
 * (spec section 45/58) - `checkout` is the single source of truth.
 */
@Component({
  selector: 'app-checkout-detail',
  imports: [
    TranslatePipe,
    Button,
    Tag,
    TableModule,
    EurCurrencyPipe,
    HrDatePipe,
    AddCheckoutItemDialogComponent,
    AddPaymentDialogComponent,
    VoidPaymentDialogComponent,
  ],
  templateUrl: './checkout-detail.component.html',
  styleUrl: './checkout-detail.component.scss',
})
export class CheckoutDetailComponent {
  private readonly checkoutsService = inject(CheckoutsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly checkout = signal<CheckoutDto | null>(null);
  readonly loading = signal(false);
  readonly completing = signal(false);
  readonly cancelling = signal(false);
  readonly removingItemId = signal<string | null>(null);

  readonly addItemDialogVisible = signal(false);
  readonly addPaymentDialogVisible = signal(false);
  readonly voidPaymentTarget = signal<PaymentDto | null>(null);

  readonly checkoutItemTypeTranslationKey = checkoutItemTypeTranslationKey;
  readonly checkoutItemTypeIcon = checkoutItemTypeIcon;
  readonly checkoutStatusTranslationKey = checkoutStatusTranslationKey;
  readonly checkoutStatusSeverity = checkoutStatusSeverity;
  readonly paymentStatusSeverity = paymentStatusSeverity;
  readonly paymentStatusTranslationKey = paymentStatusTranslationKey;
  readonly paymentMethodTranslationKey = paymentMethodTranslationKey;

  readonly isOpen = computed(() => this.checkout()?.status === 'Open');
  readonly canManage = computed(() => this.currentEmployeeService.can('checkout.manage'));

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.fetch(id);
    }
  }

  /** A Booking item is "covered by package" when it still has retail value but
   * nothing monetarily owed - never infer this from retailAmount alone (spec
   * section 33/36). */
  isPackageCovered(item: CheckoutItemDto): boolean {
    return item.type === 'Booking' && item.retailAmount > 0 && item.monetaryDue === 0;
  }

  onItemsChanged(checkout: CheckoutDto): void {
    this.checkout.set(checkout);
  }

  confirmRemoveItem(item: CheckoutItemDto): void {
    const checkout = this.checkout();
    if (!checkout) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CHECKOUT.DETAIL.REMOVE_ITEM_CONFIRM', { description: item.description }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.removingItemId.set(item.id);
        this.checkoutsService
          .removeItem(checkout.id, item.id)
          .pipe(finalize(() => this.removingItemId.set(null)))
          .subscribe({
            next: (updated) => {
              this.notifications.showSuccess(this.translate.instant('CHECKOUT.DETAIL.ITEM_REMOVED'));
              this.checkout.set(updated);
            },
            error: () => {},
          });
      },
    });
  }

  onPaymentAdded(checkout: CheckoutDto): void {
    this.checkout.set(checkout);
  }

  openVoidPayment(payment: PaymentDto): void {
    this.voidPaymentTarget.set(payment);
  }

  onVoidDialogVisibleChange(visible: boolean): void {
    if (!visible) {
      this.voidPaymentTarget.set(null);
    }
  }

  onPaymentVoided(checkout: CheckoutDto): void {
    this.checkout.set(checkout);
    this.voidPaymentTarget.set(null);
  }

  confirmComplete(): void {
    const checkout = this.checkout();
    if (!checkout) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CHECKOUT.DETAIL.CONFIRM_COMPLETE'),
      icon: 'pi pi-check-circle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.completing.set(true);
        this.checkoutsService
          .complete(checkout.id)
          .pipe(finalize(() => this.completing.set(false)))
          .subscribe({
            next: (updated) => {
              this.notifications.showSuccess(this.translate.instant('CHECKOUT.DETAIL.COMPLETED_SUCCESS'));
              this.checkout.set(updated);
            },
            // On failure (e.g. INSUFFICIENT_STOCK/CHECKOUT_OUTSTANDING_BALANCE) the
            // Checkout stays Open server-side - refresh so stock/state shown here
            // matches reality instead of silently leaving stale numbers on screen.
            error: () => this.fetch(checkout.id),
          });
      },
    });
  }

  confirmCancel(): void {
    const checkout = this.checkout();
    if (!checkout) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CHECKOUT.DETAIL.CONFIRM_CANCEL'),
      icon: 'pi pi-ban',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.cancelling.set(true);
        this.checkoutsService
          .cancel(checkout.id)
          .pipe(finalize(() => this.cancelling.set(false)))
          .subscribe({
            next: (updated) => {
              this.notifications.showSuccess(this.translate.instant('CHECKOUT.DETAIL.CANCELLED_SUCCESS'));
              this.checkout.set(updated);
            },
            error: () => {},
          });
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/app/checkout']);
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.checkoutsService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((checkout) => this.checkout.set(checkout));
  }
}
