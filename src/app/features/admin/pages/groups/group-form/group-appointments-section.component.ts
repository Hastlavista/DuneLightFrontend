import { Component, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { GroupAppointmentCellDto, GroupDetailDto } from '../../../../../core/models/group.model';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';
import { GroupAttendanceDialogComponent } from '../attendance/group-attendance-dialog.component';

/** Appointments section of the group detail page - reads GroupDetailDto's
 * already-resolved upcoming/past lists (-3/+3 month window, no extra call).
 * Row click opens the attendance modal for that occurrence. This is the only
 * place appointments are reachable from today, since Raspored (frontend #8)
 * isn't built yet. */
@Component({
  selector: 'app-admin-group-appointments-section',
  imports: [TableModule, Tabs, TabList, Tab, TabPanels, TabPanel, TranslatePipe, HrDatePipe, GroupAttendanceDialogComponent],
  templateUrl: './group-appointments-section.component.html',
  styleUrl: './group-appointments-section.component.scss',
})
export class GroupAppointmentsSectionComponent {
  readonly group = input.required<GroupDetailDto>();

  readonly attendanceDialogVisible = signal(false);
  readonly selectedAppointment = signal<GroupAppointmentCellDto | null>(null);

  openAttendance(appointment: GroupAppointmentCellDto): void {
    this.selectedAppointment.set(appointment);
    this.attendanceDialogVisible.set(true);
  }

  occupancyLabel(appointment: GroupAppointmentCellDto): string {
    return `${appointment.expectedCount}/${this.group().capacity}`;
  }
}
