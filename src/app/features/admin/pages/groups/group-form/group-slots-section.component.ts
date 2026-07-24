import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DAYS_OF_WEEK, GroupDto, GroupSlotDto, dayOfWeekTranslationKey } from '../../../../../core/models/group.model';
import { GroupsService } from '../../../../../core/services/groups.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { GroupSlotFormDialogComponent } from './group-slot-form-dialog.component';

/** Slots section of the group detail page - GroupUpdateRequest has no slots
 * field at all, they're managed exclusively through /slots endpoints. Only
 * active slots are listed (soft-deleted ones just disappear, same convention
 * as the members section). */
@Component({
  selector: 'app-admin-group-slots-section',
  imports: [TableModule, Button, TranslatePipe, GroupSlotFormDialogComponent],
  templateUrl: './group-slots-section.component.html',
  styleUrl: './group-slots-section.component.scss',
})
export class GroupSlotsSectionComponent {
  private readonly groupsService = inject(GroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly group = input.required<GroupDto>();
  readonly changed = output<void>();

  readonly dialogVisible = signal(false);
  readonly editingSlot = signal<GroupSlotDto | null>(null);

  readonly activeSlots = computed(() =>
    this.group()
      .slots.filter((slot) => slot.isActive)
      .sort((a, b) => {
        const dayDiff = DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek);
        return dayDiff !== 0 ? dayDiff : a.startTime.localeCompare(b.startTime);
      }),
  );

  readonly dayOfWeekTranslationKey = dayOfWeekTranslationKey;

  openCreate(): void {
    this.editingSlot.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(slot: GroupSlotDto): void {
    this.editingSlot.set(slot);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.changed.emit();
  }

  confirmRemove(slot: GroupSlotDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('GROUPS.SLOTS.CONFIRM_REMOVE', {
        day: this.translate.instant(dayOfWeekTranslationKey(slot.dayOfWeek)),
        time: slot.startTime.slice(0, 5),
      }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.groupsService.deleteSlot(this.group().id, slot.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('GROUPS.SLOTS.REMOVED'));
            this.changed.emit();
          },
          error: () => {},
        });
      },
    });
  }
}
