import { Component, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { ClientTagDto } from '../../../../../core/models/client-tag.model';
import { ClientTagsService } from '../../../../../core/services/client-tags.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ColorSwatchComponent } from '../../../../../shared/components/color-swatch/color-swatch.component';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { ClientTagFormDialogComponent } from './client-tag-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-client-tags',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    ColorSwatchComponent,
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

  @ViewChild('dt') private table!: Table;

  readonly items = signal<ClientTagDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly dialogVisible = signal(false);
  readonly editingTag = signal<ClientTagDto | null>(null);

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.rows.set(rows);
    this.fetch(first, rows);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.table.first = 0;
    this.fetch(0, this.rows());
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
    this.fetch(this.table?.first ?? 0, this.rows());
  }

  activate(tag: ClientTagDto): void {
    this.clientTagsService.activate(tag.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CLIENTS.TAGS.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
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
            this.fetch(this.table?.first ?? 0, this.rows());
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
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.clientTagsService
      .getPage({
        page,
        pageSize: rows,
        search: this.search() || undefined,
        isActive: this.showInactive() ? undefined : true,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
