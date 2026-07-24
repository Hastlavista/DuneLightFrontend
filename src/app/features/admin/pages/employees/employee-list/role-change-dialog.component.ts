import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { EmployeeDto } from '../../../../../core/models/employee.model';
import { UserRole, USER_ROLES, roleTranslationKey } from '../../../../../core/models/role';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';

interface RoleOption {
  label: string;
  value: UserRole;
}

/** Deliberately its own dialog rather than a field in the big employee form -
 * role changes carry their own business rule (409 LAST_ACTIVE_ADMIN, shown via
 * the standard error-toast path) and shouldn't be buried in a large save. */
@Component({
  selector: 'app-role-change-dialog',
  imports: [Dialog, ReactiveFormsModule, Select, Button, TranslatePipe],
  templateUrl: './role-change-dialog.component.html',
})
export class RoleChangeDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeesService = inject(EmployeesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly employee = input<EmployeeDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly roleOptions = computed<RoleOption[]>(() => {
    this.translationsReady();
    return USER_ROLES.map((role) => ({ label: this.translate.instant(roleTranslationKey(role)), value: role }));
  });

  readonly form = this.fb.nonNullable.group({
    role: this.fb.nonNullable.control<UserRole>('Member', Validators.required),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ role: this.employee()?.role ?? 'Member' });
      } else {
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onSave(): void {
    const employee = this.employee();
    if (!employee || this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.employeesService
      .changeRole(employee.id, this.form.getRawValue().role)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('EMPLOYEES.ROLE_CHANGED'));
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
