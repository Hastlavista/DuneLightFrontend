import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { finalize } from 'rxjs';
import { RoomDto, RoomUpsertRequest } from '../../../../../core/models/room.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { RoomsService } from '../../../../../core/services/rooms.service';

/** Create/edit dialog for one room, opened from RoomsTabComponent - same
 * shape as ServiceFormDialogComponent, scoped to the company dialog's
 * current `companyId` instead of offering its own company picker. */
@Component({
  selector: 'app-room-form-dialog',
  imports: [Dialog, ReactiveFormsModule, FormsModule, InputText, InputNumber, ToggleSwitch, Button, TranslatePipe],
  templateUrl: './room-form-dialog.component.html',
})
export class RoomFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly roomsService = inject(RoomsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly companyId = input.required<string>();
  readonly room = input<RoomDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.room() !== null);

  /** Same PrimeNG/CDK timing workaround as ServiceFormDialogComponent's
   * dialogShown - see its doc comment. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    allowConcurrentBookings: [false],
    note: [''],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.room());
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
    const request: RoomUpsertRequest = {
      companyId: this.companyId(),
      name: raw.name,
      allowConcurrentBookings: raw.allowConcurrentBookings,
      note: raw.note || null,
      sortOrder: raw.sortOrder,
    };

    const current = this.room();
    const request$ = current ? this.roomsService.update(current.id, request) : this.roomsService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant(current ? 'CATALOG.ROOMS.UPDATED' : 'CATALOG.ROOMS.CREATED'));
        this.visible.set(false);
        this.saved.emit();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  private resetForm(room: RoomDto | null): void {
    this.form.reset({
      name: room?.name ?? '',
      allowConcurrentBookings: room?.allowConcurrentBookings ?? false,
      note: room?.note ?? '',
      sortOrder: room?.sortOrder ?? 0,
    });
  }
}
