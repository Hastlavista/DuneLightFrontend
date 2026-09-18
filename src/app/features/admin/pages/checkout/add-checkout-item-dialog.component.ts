import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import {
  ClientAppointmentHistoryDto,
  appointmentStatusSeverity,
  appointmentStatusTranslationKey,
  bookingStatusSeverity,
  bookingStatusTranslationKey,
} from '../../../../core/models/appointment.model';
import { CheckoutDto } from '../../../../core/models/checkout.model';
import { PackageDto } from '../../../../core/models/package.model';
import { ProductDto, ProductStockDto } from '../../../../core/models/product.model';
import { AppointmentsService } from '../../../../core/services/appointments.service';
import { CheckoutsService } from '../../../../core/services/checkouts.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PackagesService } from '../../../../core/services/packages.service';
import { ProductsService } from '../../../../core/services/products.service';
import { StockService } from '../../../../core/services/stock.service';
import { EurCurrencyPipe } from '../../../../shared/pipes/eur-currency.pipe';

const BOOKING_PAGE_SIZE = 10;
const PRODUCT_PACKAGE_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type ItemTab = 'booking' | 'product' | 'package';

/**
 * "Add item" dialog (spec sections 12/14/16) - one dialog, three tabs, one
 * per CheckoutItemType. Stays open after a successful add so staff can add
 * several lines in one session; each add re-emits the fresh CheckoutDto so
 * the parent detail screen re-renders from server state (spec section 45).
 * Eligibility hints shown here (company/status greying) are UX only - the
 * backend remains authoritative and is the one that actually enforces them
 * (spec section 12/13).
 */
@Component({
  selector: 'app-add-checkout-item-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    Dialog,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Button,
    TableModule,
    InputNumber,
    InputText,
    Tag,
    EurCurrencyPipe,
  ],
  templateUrl: './add-checkout-item-dialog.component.html',
  styleUrl: './add-checkout-item-dialog.component.scss',
})
export class AddCheckoutItemDialogComponent {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly productsService = inject(ProductsService);
  private readonly stockService = inject(StockService);
  private readonly packagesService = inject(PackagesService);
  private readonly checkoutsService = inject(CheckoutsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly checkout = input.required<CheckoutDto>();
  readonly saved = output<CheckoutDto>();

  readonly activeTab = signal<ItemTab>('booking');

  // Booking tab
  readonly bookings = signal<ClientAppointmentHistoryDto[]>([]);
  readonly bookingsTotalCount = signal(0);
  readonly bookingsLoading = signal(false);
  readonly addingBookingId = signal<string | null>(null);
  readonly appointmentStatusTranslationKey = appointmentStatusTranslationKey;
  readonly appointmentStatusSeverity = appointmentStatusSeverity;
  readonly bookingStatusTranslationKey = bookingStatusTranslationKey;
  readonly bookingStatusSeverity = bookingStatusSeverity;

  // Product tab
  readonly products = signal<ProductDto[]>([]);
  readonly stockByProductId = signal<Record<string, number>>({});
  readonly productsLoading = signal(false);
  readonly productSearch = signal('');
  readonly productQuantities = signal<Record<string, number>>({});
  readonly addingProductId = signal<string | null>(null);
  private productSearchDebounce: ReturnType<typeof setTimeout> | undefined;

  // Package tab
  readonly packages = signal<PackageDto[]>([]);
  readonly packagesLoading = signal(false);
  readonly packageSearch = signal('');
  readonly addingPackageId = signal<string | null>(null);
  private packageSearchDebounce: ReturnType<typeof setTimeout> | undefined;

  onDialogShow(): void {
    this.activeTab.set('booking');
    this.bookings.set([]);
    this.products.set([]);
    this.packages.set([]);
    this.productSearch.set('');
    this.packageSearch.set('');
    this.fetchBookings(0, BOOKING_PAGE_SIZE);
  }

  onTabChange(tab: string | number | undefined): void {
    const value = tab as ItemTab;
    this.activeTab.set(value);
    if (value === 'product' && this.products().length === 0) {
      this.fetchProducts();
    } else if (value === 'package' && this.packages().length === 0) {
      this.fetchPackages();
    }
  }

  onBookingLazyLoad(event: TableLazyLoadEvent): void {
    this.fetchBookings(event.first ?? 0, event.rows ?? BOOKING_PAGE_SIZE);
  }

  /** "23.07.2026. 17:00" - same construction as ClientAppointmentsTabComponent's
   * dateTimeLabel, kept local since HrDatePipe has no time component. */
  dateTimeLabel(startsAt: string): string {
    const date = new Date(startsAt);
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}. ${time}`;
  }

  isEligibleBooking(booking: ClientAppointmentHistoryDto): boolean {
    return booking.bookingStatus !== 'Cancelled' && booking.companyId === this.checkout().companyId;
  }

  addBooking(booking: ClientAppointmentHistoryDto): void {
    this.addingBookingId.set(booking.bookingId);
    this.checkoutsService
      .addBookingItem(this.checkout().id, { bookingId: booking.bookingId })
      .pipe(finalize(() => this.addingBookingId.set(null)))
      .subscribe({
        next: (updated) => {
          this.notifications.showSuccess(this.translate.instant('CHECKOUT.ADD_ITEM.ITEM_ADDED'));
          this.saved.emit(updated);
        },
        error: () => {},
      });
  }

  onProductSearchInput(value: string): void {
    this.productSearch.set(value);
    clearTimeout(this.productSearchDebounce);
    this.productSearchDebounce = setTimeout(() => this.fetchProducts(), SEARCH_DEBOUNCE_MS);
  }

  stockFor(productId: string): number {
    return this.stockByProductId()[productId] ?? 0;
  }

  quantityFor(productId: string): number {
    return this.productQuantities()[productId] ?? 1;
  }

  setQuantity(productId: string, quantity: number): void {
    this.productQuantities.update((map) => ({ ...map, [productId]: quantity }));
  }

  addProduct(product: ProductDto): void {
    const quantity = this.quantityFor(product.id);
    if (!quantity || quantity < 1) {
      return;
    }
    this.addingProductId.set(product.id);
    this.checkoutsService
      .addProductItem(this.checkout().id, { productId: product.id, quantity })
      .pipe(finalize(() => this.addingProductId.set(null)))
      .subscribe({
        next: (updated) => {
          this.notifications.showSuccess(this.translate.instant('CHECKOUT.ADD_ITEM.ITEM_ADDED'));
          this.saved.emit(updated);
        },
        error: () => {},
      });
  }

  onPackageSearchInput(value: string): void {
    this.packageSearch.set(value);
    clearTimeout(this.packageSearchDebounce);
    this.packageSearchDebounce = setTimeout(() => this.fetchPackages(), SEARCH_DEBOUNCE_MS);
  }

  addPackage(pkg: PackageDto): void {
    this.addingPackageId.set(pkg.id);
    this.checkoutsService
      .addPackageItem(this.checkout().id, { packageId: pkg.id })
      .pipe(finalize(() => this.addingPackageId.set(null)))
      .subscribe({
        next: (updated) => {
          this.notifications.showSuccess(this.translate.instant('CHECKOUT.ADD_ITEM.ITEM_ADDED'));
          this.saved.emit(updated);
        },
        error: () => {},
      });
  }

  close(): void {
    this.visible.set(false);
  }

  private fetchBookings(first: number, rows: number): void {
    this.bookingsLoading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.appointmentsService
      .getByClient(this.checkout().clientId, { page, pageSize: rows })
      .pipe(finalize(() => this.bookingsLoading.set(false)))
      .subscribe((result) => {
        this.bookings.set(result.items);
        this.bookingsTotalCount.set(result.totalCount);
      });
  }

  private fetchProducts(): void {
    this.productsLoading.set(true);
    this.productsService
      .getPage(
        { page: 1, pageSize: PRODUCT_PACKAGE_PAGE_SIZE, search: this.productSearch() || undefined, isActive: true },
        { suppressErrorToast: true },
      )
      .pipe(finalize(() => this.productsLoading.set(false)))
      .subscribe((result) => {
        this.products.set(result.items);
        this.productQuantities.set(
          result.items.reduce<Record<string, number>>((acc, product) => {
            acc[product.id] = 1;
            return acc;
          }, {}),
        );
      });

    this.stockService.getByCompany(this.checkout().companyId, { suppressErrorToast: true }).subscribe((rows: ProductStockDto[]) => {
      this.stockByProductId.set(
        rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.productId] = row.quantity;
          return acc;
        }, {}),
      );
    });
  }

  private fetchPackages(): void {
    this.packagesLoading.set(true);
    this.packagesService
      .getPage(
        { page: 1, pageSize: PRODUCT_PACKAGE_PAGE_SIZE, search: this.packageSearch() || undefined, isActive: true },
        { suppressErrorToast: true },
      )
      .pipe(finalize(() => this.packagesLoading.set(false)))
      .subscribe((result) => this.packages.set(result.items));
  }
}
