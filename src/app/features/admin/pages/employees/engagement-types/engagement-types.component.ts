import { Component, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { EngagementTypeDto } from '../../../../../core/models/engagement-type.model';
import { EngagementTypesService } from '../../../../../core/services/engagement-types.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { EngagementTypeFormDialogComponent } from './engagement-type-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-engagement-types',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    EngagementTypeFormDialogComponent,
  ],
  templateUrl: './engagement-types.component.html',
  styleUrl: './engagement-types.component.scss',
})
export class EngagementTypesComponent {
  private readonly engagementTypesService = inject(EngagementTypesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<EngagementTypeDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly dialogVisible = signal(false);
  readonly editingType = signal<EngagementTypeDto | null>(null);

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
    this.editingType.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(type: EngagementTypeDto): void {
    this.editingType.set(type);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
  }

  activate(type: EngagementTypeDto): void {
    this.engagementTypesService.activate(type.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('EMPLOYEES.ENGAGEMENT_TYPES.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
      },
      error: () => {},
    });
  }

  confirmDeactivate(type: EngagementTypeDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('EMPLOYEES.ENGAGEMENT_TYPES.CONFIRM_DEACTIVATE', { name: type.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.engagementTypesService.deactivate(type.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('EMPLOYEES.ENGAGEMENT_TYPES.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(type: EngagementTypeDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('EMPLOYEES.ENGAGEMENT_TYPES.CONFIRM_DELETE', { name: type.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.engagementTypesService.delete(type.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('EMPLOYEES.ENGAGEMENT_TYPES.DELETED'));
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
    this.engagementTypesService
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
