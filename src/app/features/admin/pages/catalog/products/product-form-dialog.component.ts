import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { ProductDto, ProductUpsertRequest } from '../../../../../core/models/product.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ProductsService } from '../../../../../core/services/products.service';

/**
 * Create/edit dialog for a Product (grant products.manage). Mirrors
 * EngagementTypeFormDialogComponent's shape - a single-tab šifrarnik dialog,
 * no wizard. SKU is optional but DUPLICATE_SKU (surfaced via the default
 * error toast, same as any other business-rule error) means the backend
 * remembers it even across inactive products - the frontend doesn't try to
 * pre-validate that itself.
 */
@Component({
  selector: 'app-product-form-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, InputNumber, Button, TranslatePipe],
  templateUrl: './product-form-dialog.component.html',
  styleUrl: './product-form-dialog.component.scss',
})
export class ProductFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly product = input<ProductDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.product() !== null);

  /** Same PrimeNG/CDK open-transition timing issue as the other šifrarnik
   * dialogs in this app - see ServiceFormDialogComponent's doc. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    sku: ['', Validators.maxLength(100)],
    defaultPrice: [0, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.product());
      } else {
        this.dialogShown.set(false);
      }
    });
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
    const request: ProductUpsertRequest = {
      name: raw.name,
      description: raw.description || null,
      sku: raw.sku || null,
      defaultPrice: raw.defaultPrice,
    };

    const current = this.product();
    const request$ = current
      ? this.productsService.update(current.id, request)
      : this.productsService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'CATALOG.PRODUCTS.UPDATED' : 'CATALOG.PRODUCTS.CREATED'),
        );
        this.visible.set(false);
        this.saved.emit();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  private resetForm(product: ProductDto | null): void {
    this.form.reset({
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      defaultPrice: product?.defaultPrice ?? 0,
      description: product?.description ?? '',
    });
  }
}
