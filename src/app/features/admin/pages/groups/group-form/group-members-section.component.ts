import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { GroupDetailDto, GroupMemberDto } from '../../../../../core/models/group.model';
import { GroupsService } from '../../../../../core/services/groups.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';
import { AddGroupMemberDialogComponent } from './add-group-member-dialog.component';

/** Members section of the group detail page - POST/DELETE .../members. Adding
 * always inserts a new membership row (never reactivates a past one, see
 * GroupsService.addMember), so only currently active members are listed here;
 * past memberships aren't surfaced in this view. Capacity is a warning, not a
 * limit - a member is always added, any over-capacity warning comes back on
 * the response and is shown as a toast, not a blocker. Adding itself happens
 * in AddGroupMemberDialogComponent (a searchable/paginated modal); this
 * section only owns the "already a member" table and the button that opens it. */
@Component({
  selector: 'app-admin-group-members-section',
  imports: [TableModule, Button, TranslatePipe, HrDatePipe, AddGroupMemberDialogComponent],
  templateUrl: './group-members-section.component.html',
  styleUrl: './group-members-section.component.scss',
})
export class GroupMembersSectionComponent {
  private readonly groupsService = inject(GroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly group = input.required<GroupDetailDto>();
  readonly changed = output<void>();

  readonly addDialogVisible = signal(false);

  readonly activeMembers = computed(() =>
    [...this.group().members]
      .filter((member) => member.isActive)
      .sort((a, b) => a.clientName.localeCompare(b.clientName)),
  );

  openAddDialog(): void {
    this.addDialogVisible.set(true);
  }

  onMemberAdded(): void {
    this.changed.emit();
  }

  confirmRemove(member: GroupMemberDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('GROUPS.MEMBERS.CONFIRM_REMOVE', { name: member.clientName }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.groupsService.deleteMember(this.group().id, member.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('GROUPS.MEMBERS.REMOVED'));
            this.changed.emit();
          },
          error: () => {},
        });
      },
    });
  }
}
