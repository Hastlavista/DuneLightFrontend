import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { finalize } from 'rxjs';
import { ClientTagDto } from '../../../../../core/models/client-tag.model';
import { ClientTagsService } from '../../../../../core/services/client-tags.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { ClientTagFormDialogComponent } from './client-tag-form-dialog.component';

const TAG_CATALOG_PAGE_SIZE = 200;

@Component({
  selector: 'app-admin-client-tags',
  imports: [
    Button,
    TranslatePipe,
    StatusTagComponent,
    ClientTagFormDialogComponent,
  ],
  templateUrl: './client-tags.component.html',
  styleUrl: './client-tags.component.scss',
})
export class ClientTagsComponent {
  private readonly clientTagsService = inject(ClientTagsService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly items = signal<ClientTagDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly activeCount = computed(() => this.items().filter((tag) => tag.isActive).length);

  readonly dialogVisible = signal(false);
  readonly editingTag = signal<ClientTagDto | null>(null);

  constructor() {
    this.fetch();
  }

  openCreate(): void {
    this.editingTag.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(tag: ClientTagDto): void {
    this.editingTag.set(tag);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch();
  }

  activate(tag: ClientTagDto): void {
    this.clientTagsService.activate(tag.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CLIENTS.TAGS.ACTIVATED'));
        this.fetch();
      },
      error: () => {},
    });
  }

  confirmDeactivate(tag: ClientTagDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CLIENTS.TAGS.CONFIRM_DEACTIVATE', { name: tag.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.clientTagsService.deactivate(tag.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CLIENTS.TAGS.DEACTIVATED'));
            this.fetch();
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(tag: ClientTagDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CLIENTS.TAGS.CONFIRM_DELETE', { name: tag.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.clientTagsService.delete(tag.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CLIENTS.TAGS.DELETED'));
            this.fetch();
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(): void {
    this.loading.set(true);
    this.clientTagsService
      .getPage({
        page: 1,
        pageSize: TAG_CATALOG_PAGE_SIZE,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
