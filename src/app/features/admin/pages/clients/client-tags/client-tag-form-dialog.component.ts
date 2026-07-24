import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { ClientTagDto, ClientTagUpsertRequest } from '../../../../../core/models/client-tag.model';
import { ClientTagsService } from '../../../../../core/services/client-tags.service';
import { NotificationService } from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-client-tag-form-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, InputNumber, ColorPicker, Button, TranslatePipe],
  templateUrl: './client-tag-form-dialog.component.html',
})
export class ClientTagFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly clientTagsService = inject(ClientTagsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly tag = input<ClientTagDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.tag() !== null);

  /** See CategoryFormDialogComponent - only render the form once p-dialog's own
   * open transition has finished, to sidestep a PrimeNG/CDK timing issue. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    colorHex: [''],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.tag());
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
    const request: ClientTagUpsertRequest = {
      name: raw.name,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      sortOrder: raw.sortOrder,
    };

    const current = this.tag();
    const request$ = current
      ? this.clientTagsService.update(current.id, request)
      : this.clientTagsService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'CLIENTS.TAGS.UPDATED' : 'CLIENTS.TAGS.CREATED'),
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

  private resetForm(tag: ClientTagDto | null): void {
    this.form.reset({
      name: tag?.name ?? '',
      colorHex: tag?.colorHex ? tag.colorHex.replace('#', '') : '',
      sortOrder: tag?.sortOrder ?? 0,
    });
  }
}
