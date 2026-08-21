import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { RoleDto } from '../../../../../core/models/permissions.model';
import { PermissionRolesService } from '../../../../../core/services/permission-roles.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { RoleFormDialogComponent } from './role-form-dialog.component';

/** Roles (Owner-only, business-facing tags e.g. "Trener") - a plain šifrarnik,
 * simplest CRUD pattern in the app: flat list (not paged), no isActive, modal
 * form. Client-side search filter, same rationale as GrantGroupsComponent. */
@Component({
  selector: 'app-admin-roles',
  imports: [TableModule, Button, IconField, InputIcon, InputText, FormsModule, TranslatePipe, RoleFormDialogComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent {
  private readonly rolesService = inject(PermissionRolesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly allItems = signal<RoleDto[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');

  readonly dialogVisible = signal(false);
  readonly editingRole = signal<RoleDto | null>(null);

  readonly items = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.allItems();
    }
    return this.allItems().filter((role) => role.name.toLowerCase().includes(term));
  });

  constructor() {
    this.fetch();
  }

  openCreate(): void {
    this.editingRole.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(role: RoleDto): void {
    this.editingRole.set(role);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch();
  }

  confirmDelete(role: RoleDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('PERMISSIONS.ROLES.CONFIRM_DELETE', { name: role.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.rolesService.delete(role.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('PERMISSIONS.ROLES.DELETED'));
            this.fetch();
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(): void {
    this.loading.set(true);
    this.rolesService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => this.allItems.set(result));
  }
}
