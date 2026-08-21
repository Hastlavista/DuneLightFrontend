import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { DAYS_OF_WEEK, GroupDto, dayOfWeekShortTranslationKey } from '../../../../core/models/group.model';
import { GroupsService } from '../../../../core/services/groups.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ListToolbarComponent } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../shared/components/status-tag/status-tag.component';
import { GenerateAppointmentsDialogComponent } from './generate-appointments-dialog.component';

/** Groups list - GET /api/groups isn't paginated (a flat array), so this loads
 * everything once and paginates/filters client-side (search + show-inactive),
 * unlike every other admin šifrarnik screen which pages server-side. */
@Component({
  selector: 'app-admin-groups',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    GenerateAppointmentsDialogComponent,
  ],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss',
})
export class GroupsComponent {
  private readonly groupsService = inject(GroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly allItems = signal<GroupDto[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly generateDialogVisible = signal(false);
  readonly generateForGroup = signal<GroupDto | null>(null);

  readonly items = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.allItems().filter((group) => {
      if (!this.showInactive() && !group.isActive) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        group.name.toLowerCase().includes(term) ||
        group.serviceName.toLowerCase().includes(term) ||
        group.companyName.toLowerCase().includes(term) ||
        (group.defaultTrainerName ?? '').toLowerCase().includes(term)
      );
    });
  });

  constructor() {
    this.fetch();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
  }

  openCreate(): void {
    this.router.navigate(['/admin/groups/new']);
  }

  openEdit(group: GroupDto): void {
    this.router.navigate(['/admin/groups', group.id]);
  }

  openGenerateForAll(): void {
    this.generateForGroup.set(null);
    this.generateDialogVisible.set(true);
  }

  openGenerateForGroup(group: GroupDto): void {
    this.generateForGroup.set(group);
    this.generateDialogVisible.set(true);
  }

  slotsSummary(group: GroupDto): string {
    return group.slots
      .filter((slot) => slot.isActive)
      .sort((a, b) => DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek))
      .map((slot) => `${this.translate.instant(dayOfWeekShortTranslationKey(slot.dayOfWeek))} ${slot.startTime.slice(0, 5)}`)
      .join(', ');
  }

  isOverCapacity(group: GroupDto): boolean {
    return group.activeMemberCount > group.capacity;
  }

  activate(group: GroupDto): void {
    this.groupsService.activate(group.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('GROUPS.ACTIVATED'));
        this.fetch();
      },
      error: () => {},
    });
  }

  confirmDeactivate(group: GroupDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('GROUPS.CONFIRM_DEACTIVATE', { name: group.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.groupsService.deactivate(group.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('GROUPS.DEACTIVATED'));
            this.fetch();
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(): void {
    this.loading.set(true);
    this.groupsService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => this.allItems.set(result));
  }
}
