import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { LocationDto, LocationUpsertRequest } from '../../../../../core/models/location.model';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';

/** Olive-gold from the dune palette - a sensible default when creating a new
 * location, before the user picks their own color. */
const DEFAULT_COLOR_NO_HASH = '8F7A45';

@Component({
  selector: 'app-location-form-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, Textarea, InputNumber, ColorPicker, Button, TranslatePipe],
  templateUrl: './location-form-dialog.component.html',
})
export class LocationFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly locationsService = inject(LocationsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly location = input<LocationDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.location() !== null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    address: ['', Validators.maxLength(500)],
    phone: ['', Validators.maxLength(50)],
    colorHex: [DEFAULT_COLOR_NO_HASH],
    note: [''],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.location());
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: LocationUpsertRequest = {
      name: raw.name,
      address: raw.address || null,
      phone: raw.phone || null,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      note: raw.note || null,
      sortOrder: raw.sortOrder,
    };

    const current = this.location();
    const request$ = current
      ? this.locationsService.update(current.id, request)
      : this.locationsService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'CATALOG.LOCATIONS.UPDATED' : 'CATALOG.LOCATIONS.CREATED'),
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

  private resetForm(location: LocationDto | null): void {
    this.form.reset({
      name: location?.name ?? '',
      address: location?.address ?? '',
      phone: location?.phone ?? '',
      colorHex: location?.colorHex ? location.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      note: location?.note ?? '',
      sortOrder: location?.sortOrder ?? 0,
    });
  }
}
