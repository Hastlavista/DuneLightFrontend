import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { ClientPackagePurchaseRequest } from '../../../../../core/models/client-package.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { PackageDto } from '../../../../../core/models/package.model';
import { ClientPackagesService } from '../../../../../core/services/client-packages.service';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PackagesService } from '../../../../../core/services/packages.service';
import { PriceListService } from '../../../../../core/services/price-list.service';
import { toStartOfDayIso } from '../../../../../core/utils/date.util';

const LOOKUP_PAGE_SIZE = 200;

/**
 * "Izdaj paket" modal on the client's Paketi tab - POST /api/clients/{clientId}/packages.
 * `locationId` here is only ever used to resolve a suggested price (via
 * PriceListService.resolve, same call as the Cjenik "provjeri cijenu" panel) -
 * it isn't sent as part of the sold package's own data beyond that suggestion.
 */
@Component({
  selector: 'app-issue-package-dialog',
  imports: [Dialog, ReactiveFormsModule, Select, DatePicker, InputNumber, Button, TranslatePipe],
  templateUrl: './issue-package-dialog.component.html',
})
export class IssuePackageDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly packagesService = inject(PackagesService);
  private readonly locationsService = inject(LocationsService);
  private readonly priceListService = inject(PriceListService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly clientId = input.required<string>();
  readonly issued = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);

  readonly activePackages = signal<PackageDto[]>([]);
  readonly activeLocations = signal<LocationDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    packageId: this.fb.control<string | null>(null, Validators.required),
    locationId: this.fb.control<string | null>(null),
    purchaseDate: this.fb.control<Date | null>(new Date()),
    paidPrice: this.fb.control<number | null>(null),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm();
        this.loadActivePackages();
        this.loadActiveLocations();
      } else {
        this.dialogShown.set(false);
      }
    });

    this.form.controls.packageId.valueChanges.subscribe(() => this.refreshSuggestedPrice());
    this.form.controls.locationId.valueChanges.subscribe(() => this.refreshSuggestedPrice());
    this.form.controls.purchaseDate.valueChanges.subscribe(() => this.refreshSuggestedPrice());
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: ClientPackagePurchaseRequest = {
      packageId: raw.packageId as string,
      purchaseDate: raw.purchaseDate ? toStartOfDayIso(raw.purchaseDate) : null,
      paidPrice: raw.paidPrice,
      companyId: raw.locationId,
    };

    this.saving.set(true);
    this.clientPackagesService
      .issue(this.clientId(), request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('CLIENTS.PACKAGES.ISSUED'));
          this.visible.set(false);
          this.issued.emit();
        },
        error: () => {},
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  private refreshSuggestedPrice(): void {
    const packageId = this.form.controls.packageId.value;
    const locationId = this.form.controls.locationId.value;
    const date = this.form.controls.purchaseDate.value ?? new Date();
    if (!packageId || !locationId) {
      return;
    }
    this.priceListService
      .resolve({ subjectType: 'Package', subjectId: packageId, companyId: locationId, date: toStartOfDayIso(date) })
      .subscribe({
        next: (result) => this.form.controls.paidPrice.setValue(result.price, { emitEvent: false }),
        error: () => {},
      });
  }

  private resetForm(): void {
    this.form.reset({
      packageId: null,
      locationId: null,
      purchaseDate: new Date(),
      paidPrice: null,
    });
  }

  private loadActivePackages(): void {
    this.packagesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activePackages.set(result.items));
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }
}
