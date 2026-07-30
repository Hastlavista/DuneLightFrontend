import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { DAYS_OF_WEEK, GroupDto, dayOfWeekShortTranslationKey } from '../../../../core/models/group.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { GroupsService } from '../../../../core/services/groups.service';

/**
 * "Moje grupe" - GET /api/groups has no trainer filter, so this fetches the
 * same flat list GroupsComponent (admin) does and filters client-side to
 * active groups where the logged-in employee is the default trainer
 * (`defaultTrainerId`). Groups reached only via a swapped-in substitute
 * trainer (no `defaultTrainerId` match) aren't covered here - a rarer case,
 * left out per the frontend #12 spec. Read-only list; edit/generate/activate
 * stay Admin-only (see GroupsComponent) so this is a new, simpler component
 * rather than a stripped-down reuse of that one.
 */
@Component({
  selector: 'app-trainer-my-groups',
  imports: [TableModule, TranslatePipe],
  templateUrl: './my-groups.component.html',
  styleUrl: './my-groups.component.scss',
})
export class MyGroupsComponent {
  private readonly groupsService = inject(GroupsService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  private readonly allGroups = signal<GroupDto[]>([]);

  readonly items = computed(() => {
    const currentEmployeeId = this.currentEmployeeService.employee()?.employeeId;
    if (!currentEmployeeId) {
      return [];
    }
    return this.allGroups().filter((group) => group.isActive && group.defaultTrainerId === currentEmployeeId);
  });

  constructor() {
    this.fetch();
  }

  openGroup(group: GroupDto): void {
    this.router.navigate(['/app/my-groups', group.id]);
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

  private fetch(): void {
    this.loading.set(true);
    this.groupsService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => this.allGroups.set(result));
  }
}
