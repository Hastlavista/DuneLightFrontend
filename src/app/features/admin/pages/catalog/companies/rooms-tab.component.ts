import { Component, ViewChild, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { RoomDto } from '../../../../../core/models/room.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { RoomsService } from '../../../../../core/services/rooms.service';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { RoomFormDialogComponent } from './room-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

/** "Prostorije" tab on the company form dialog (see CompanyFormDialogComponent) -
 * same self-contained-per-owner shape as CompanyHolidaysTabComponent, but a
 * full šifrarnik (edit/activate/deactivate/delete, not just add+delete) so it
 * mirrors CompaniesComponent/CatalogServicesComponent's table+dialog pair
 * instead. Action-level gating on catalog.rooms.manage (see ACTION_POLICIES) -
 * the tab's own visibility is separately grant-gated on catalog.rooms.view/.manage
 * (see CompanyFormDialogComponent.canViewRooms). */
@Component({
  selector: 'app-rooms-tab',
  imports: [TableModule, Button, TranslatePipe, ListToolbarComponent, StatusTagComponent, RoomFormDialogComponent],
  templateUrl: './rooms-tab.component.html',
  styleUrl: './rooms-tab.component.scss',
})
export class RoomsTabComponent {
  private readonly roomsService = inject(RoomsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly companyId = input.required<string>();

  @ViewChild('dt') private table!: Table;

  readonly items = signal<RoomDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly dialogVisible = signal(false);
  readonly editingRoom = signal<RoomDto | null>(null);

  constructor() {
    effect(() => {
      // Re-fetch from row 0 whenever the owning company changes (in practice
      // only once, right after this tab unlocks post-create - see
      // CompanyFormDialogComponent.createdCompanyId).
      this.companyId();
      this.fetch(0, this.rows());
    });
  }

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
    this.editingRoom.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(room: RoomDto): void {
    this.editingRoom.set(room);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
  }

  activate(room: RoomDto): void {
    this.roomsService.activate(room.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.ROOMS.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
      },
      error: () => {},
    });
  }

  confirmDeactivate(room: RoomDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.ROOMS.CONFIRM_DEACTIVATE', { name: room.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.roomsService.deactivate(room.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.ROOMS.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(room: RoomDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.ROOMS.CONFIRM_DELETE', { name: room.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.roomsService.delete(room.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.ROOMS.DELETED'));
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
    this.roomsService
      .getPage(
        {
          page,
          pageSize: rows,
          search: this.search() || undefined,
          isActive: this.showInactive() ? undefined : true,
        },
        { extraParams: { companyId: this.companyId() } },
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
