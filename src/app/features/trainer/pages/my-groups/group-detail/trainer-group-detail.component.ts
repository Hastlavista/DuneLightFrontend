import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { GroupDetailDto } from '../../../../../core/models/group.model';
import { GroupsService } from '../../../../../core/services/groups.service';
import { GroupAppointmentsSectionComponent } from '../../../../admin/pages/groups/group-form/group-appointments-section.component';
import { GroupMembersSectionComponent } from '../../../../admin/pages/groups/group-form/group-members-section.component';
import { GroupSlotsSectionComponent } from '../../../../admin/pages/groups/group-form/group-slots-section.component';

/**
 * "Moje grupe" detail - read-only counterpart to admin's GroupFormComponent,
 * reached from MyGroupsComponent. Definition/slots/members editing stays
 * Admin-only (see GroupSlotsSectionComponent/GroupMembersSectionComponent's
 * new `readOnly` input), so rather than bolting a read-only mode onto the
 * admin form (a full reactive form with create-mode slot rows that a trainer
 * never uses), this is its own small page: basic info as plain text, plus the
 * same three sections the admin detail page shows. GroupAppointmentsSectionComponent
 * needs no `readOnly` variant at all - it was already read-only (a click just
 * opens the attendance dialog for that occurrence).
 */
@Component({
  selector: 'app-trainer-group-detail',
  imports: [Button, TranslatePipe, GroupSlotsSectionComponent, GroupMembersSectionComponent, GroupAppointmentsSectionComponent],
  templateUrl: './trainer-group-detail.component.html',
  styleUrl: './trainer-group-detail.component.scss',
})
export class TrainerGroupDetailComponent {
  private readonly groupsService = inject(GroupsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly group = signal<GroupDetailDto | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadGroup(id);
    }
  }

  onBack(): void {
    this.router.navigate(['/app/my-groups']);
  }

  private loadGroup(id: string): void {
    this.loading.set(true);
    this.groupsService.getById(id).subscribe({
      next: (group) => {
        this.group.set(group);
        this.loading.set(false);
      },
      error: () => this.onBack(),
    });
  }
}
