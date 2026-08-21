import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { GrantGroupDto } from '../../../../../core/models/permissions.model';
import { GrantGroupsService } from '../../../../../core/services/grant-groups.service';
import { NotificationService } from '../../../../../core/services/notification.service';

/** GrantGroups (Owner-only) - GET isn't paginated (a flat array, same as
 * Grupe), and there's no isActive/activate/deactivate concept here at all -
 * unlike every catalog šifrarnik, a GrantGroup is either present (and usable)
 * or deleted (blocked while any user still references it). Client-side
 * search filter, same rationale as GroupsComponent. */
@Component({
  selector: 'app-admin-grant-groups',
  imports: [TableModule, Button, IconField, InputIcon, InputText, FormsModule, TranslatePipe],
  templateUrl: './grant-groups.component.html',
  styleUrl: './grant-groups.component.scss',
})
export class GrantGroupsComponent {
  private readonly grantGroupsService = inject(GrantGroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly allItems = signal<GrantGroupDto[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');

  readonly items = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.allItems();
    }
    return this.allItems().filter((group) => group.name.toLowerCase().includes(term));
  });

  constructor() {
    this.fetch();
  }

  openCreate(): void {
    this.router.navigate(['/admin/permissions/grant-groups/new']);
  }

  openEdit(group: GrantGroupDto): void {
    this.router.navigate(['/admin/permissions/grant-groups', group.id]);
  }

  confirmDelete(group: GrantGroupDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('PERMISSIONS.GRANT_GROUPS.CONFIRM_DELETE', { name: group.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.grantGroupsService.delete(group.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('PERMISSIONS.GRANT_GROUPS.DELETED'));
            this.fetch();
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(): void {
    this.loading.set(true);
    this.grantGroupsService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => this.allItems.set(result));
  }
}
