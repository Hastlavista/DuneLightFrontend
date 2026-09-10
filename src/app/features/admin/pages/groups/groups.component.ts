import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { DAYS_OF_WEEK, GroupDto, dayOfWeekShortTranslationKey } from '../../../../core/models/group.model';
import { GroupsService } from '../../../../core/services/groups.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { timeOfDayLabel } from '../../../../core/utils/time-of-day.util';
import { ListToolbarComponent } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { GenerateAppointmentsDialogComponent } from './generate-appointments-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

/** Groups list - GET /api/groups isn't paginated (a flat array), so this loads
 * everything once and paginates/filters client-side (search + show-inactive),
 * unlike every other admin šifrarnik screen which pages server-side. */
@Component({
  selector: 'app-admin-groups',
  imports: [
    Button,
    Paginator,
    Select,
    FormsModule,
    TranslatePipe,
    ListToolbarComponent,
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

  readonly dayOfWeekShortTranslationKey = dayOfWeekShortTranslationKey;

  readonly allItems = signal<GroupDto[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly companyFilter = signal<string | null>(null);
  readonly trainerFilter = signal<string | null>(null);
  readonly capacityFilter = signal<'all' | 'available' | 'full' | 'empty'>('all');
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly first = signal(0);

  readonly generateDialogVisible = signal(false);
  readonly generateForGroup = signal<GroupDto | null>(null);

  readonly activeGroups = computed(() => this.allItems().filter((group) => group.isActive));
  readonly weeklySlots = computed(() => this.activeGroups().reduce((total, group) => total + group.slots.filter((slot) => slot.isActive).length, 0));
  readonly totalCapacity = computed(() => this.activeGroups().reduce((total, group) => total + group.capacity, 0));
  readonly totalMembers = computed(() => this.activeGroups().reduce((total, group) => total + group.activeMemberCount, 0));
  readonly occupancyPercent = computed(() => this.totalCapacity() ? Math.round((this.totalMembers() / this.totalCapacity()) * 100) : 0);
  readonly fullGroups = computed(() => this.activeGroups().filter((group) => group.activeMemberCount >= group.capacity).length);
  readonly companies = computed(() => {
    const byId = new Map<string, string>();
    this.allItems().forEach((group) => byId.set(group.companyId, group.companyName));
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  });
  readonly trainers = computed(() => {
    const byId = new Map<string, string>();
    this.allItems().forEach((group) => {
      if (group.defaultTrainerId && group.defaultTrainerName) {
        byId.set(group.defaultTrainerId, group.defaultTrainerName);
      }
    });
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  });
  readonly companyFilterOptions = computed(() => [
    { label: 'Sve poslovnice', value: null as string | null },
    ...this.companies().map((company) => ({ label: company.name, value: company.id })),
  ]);
  readonly trainerFilterOptions = computed(() => [
    { label: 'Svi treneri', value: null as string | null },
    ...this.trainers().map((trainer) => ({ label: trainer.name, value: trainer.id })),
  ]);

  readonly items = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.allItems().filter((group) => {
      if (!this.showInactive() && !group.isActive) {
        return false;
      }
      if (this.companyFilter() && group.companyId !== this.companyFilter()) {
        return false;
      }
      if (this.trainerFilter() && group.defaultTrainerId !== this.trainerFilter()) {
        return false;
      }
      if (this.capacityFilter() === 'available' && group.activeMemberCount >= group.capacity) {
        return false;
      }
      if (this.capacityFilter() === 'full' && group.activeMemberCount < group.capacity) {
        return false;
      }
      if (this.capacityFilter() === 'empty' && group.activeMemberCount !== 0) {
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

  readonly pagedItems = computed(() => this.items().slice(this.first(), this.first() + this.rows()));

  constructor() {
    this.fetch();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.first.set(0);
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.first.set(0);
  }

  onPageChange(event: PaginatorState): void {
    this.rows.set(event.rows ?? this.rows());
    this.first.set(event.first ?? 0);
  }

  selectCompany(id: string | null): void {
    this.companyFilter.set(id);
    this.first.set(0);
  }

  onCompanyFilterChange(id: string | null): void {
    this.selectCompany(id);
  }

  selectTrainer(id: string | null): void {
    this.trainerFilter.set(id);
    this.first.set(0);
  }

  onTrainerFilterChange(id: string | null): void {
    this.selectTrainer(id);
  }

  selectCapacity(filter: 'all' | 'available' | 'full' | 'empty'): void {
    this.capacityFilter.set(filter);
    this.first.set(0);
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
      .filter((slot) => slot?.isActive && slot.startTime)
      .sort((a, b) => DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek))
      .map((slot) => `${this.translate.instant(dayOfWeekShortTranslationKey(slot.dayOfWeek))} ${timeOfDayLabel(slot.startTime)}`)
      .join(', ');
  }

  initials(group: GroupDto): string {
    return group.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  isOverCapacity(group: GroupDto): boolean {
    return group.activeMemberCount > group.capacity;
  }

  occupancyFor(group: GroupDto): number {
    return group.capacity ? Math.min(100, Math.round((group.activeMemberCount / group.capacity) * 100)) : 0;
  }

  availabilityLabel(group: GroupDto): string {
    if (group.activeMemberCount >= group.capacity) {
      return 'Puno';
    }
    if (this.occupancyFor(group) >= 80) {
      return 'Skoro puno';
    }
    return 'Ima mjesta';
  }

  freePlacesLabel(group: GroupDto): string {
    const free = Math.max(0, group.capacity - group.activeMemberCount);
    return free === 1 ? '1 slobodno mjesto' : `${free} slobodnih mjesta`;
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
      header: this.translate.instant('GROUPS.CONFIRM_DEACTIVATE_HEADER'),
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
