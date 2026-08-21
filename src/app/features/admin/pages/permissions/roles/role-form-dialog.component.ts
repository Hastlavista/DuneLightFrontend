import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { RoleDto, RoleUpsertRequest } from '../../../../../core/models/permissions.model';
import { PermissionRolesService } from '../../../../../core/services/permission-roles.service';
import { NotificationService } from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-role-form-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, Button, TranslatePipe],
  templateUrl: './role-form-dialog.component.html',
})
export class RoleFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rolesService = inject(PermissionRolesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly role = input<RoleDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.role() !== null);

  /** See CategoryFormDialogComponent - only render the form once p-dialog's own
   * open transition has finished, to sidestep a PrimeNG/CDK timing issue. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ name: this.role()?.name ?? '' });
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

    const request: RoleUpsertRequest = { name: this.form.getRawValue().name };
    const current = this.role();
    const request$ = current ? this.rolesService.update(current.id, request) : this.rolesService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'PERMISSIONS.ROLES.UPDATED' : 'PERMISSIONS.ROLES.CREATED'),
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
}
