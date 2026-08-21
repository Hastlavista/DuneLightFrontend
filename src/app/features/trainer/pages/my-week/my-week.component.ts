import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { AppointmentScheduleCellDto } from '../../../../core/models/appointment.model';
import { EmployeeDirectoryDto } from '../../../../core/models/employee.model';
import { GroupAppointmentCellDto, GroupDto } from '../../../../core/models/group.model';
import { LocationDto } from '../../../../core/models/location.model';
import { ScheduleBreakCellDto } from '../../../../core/models/schedule-break.model';
import { ServiceDto } from '../../../../core/models/service.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../core/services/employees.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { LocationContextService } from '../../../../core/services/location-context.service';
import { LocationsService } from '../../../../core/services/locations.service';
import { ServicesService } from '../../../../core/services/services.service';
import { AppointmentDetailDialogComponent } from '../../../../shared/components/appointment-detail-dialog/appointment-detail-dialog.component';
import { NewAppointmentDialogComponent, NewAppointmentInitial } from '../../../../shared/components/new-appointment-dialog/new-appointment-dialog.component';
import { toGroupAppointmentCell } from '../../../../shared/components/schedule-grid/schedule-cell-view.util';
import { CompleteEmployeeProfileCtaComponent } from '../../../../shared/components/complete-employee-profile/complete-employee-profile-cta.component';
import { ScheduleBreakDialogComponent } from '../../../../shared/components/schedule-break-dialog/schedule-break-dialog.component';
import { ScheduleBreakFormDialogComponent } from '../../../../shared/components/schedule-break-form-dialog/schedule-break-form-dialog.component';
import { ScheduleWeekGridComponent } from '../../../../shared/components/schedule-week-grid/schedule-week-grid.component';
import { GroupAttendanceDialogComponent } from '../../../admin/pages/groups/attendance/group-attendance-dialog.component';

const LOOKUP_PAGE_SIZE = 200;

/**
 * "Moj tjedan" - the trainer's landing screen. Reuses ScheduleWeekGridComponent
 * (grid B) exactly as admin's ScheduleComponent does in week mode, just with
 * `employeeId` pinned to the logged-in employee instead of an admin-picked
 * trainer - no trainer picker here at all, see the component's own doc comment.
 * Dialog wiring (detail/attendance/new appointment) mirrors ScheduleComponent's
 * 1:1, just scoped to a single grid instance.
 */
@Component({
  selector: 'app-trainer-my-week',
  imports: [
    ScheduleWeekGridComponent,
    AppointmentDetailDialogComponent,
    GroupAttendanceDialogComponent,
    NewAppointmentDialogComponent,
    ScheduleBreakDialogComponent,
    ScheduleBreakFormDialogComponent,
    CompleteEmployeeProfileCtaComponent,
    Button,
    TranslatePipe,
  ],
  templateUrl: './my-week.component.html',
  styleUrl: './my-week.component.scss',
})
export class MyWeekComponent {
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly groupsService = inject(GroupsService);
  private readonly locationContext = inject(LocationContextService);
  private readonly locationsService = inject(LocationsService);
  private readonly servicesService = inject(ServicesService);

  readonly weekGrid = viewChild<ScheduleWeekGridComponent>('weekGrid');

  readonly currentEmployeeId = computed(() => this.currentEmployeeService.employee()?.employeeId ?? null);
  /** Owner without an Employee profile yet (see CurrentEmployeeService's doc) -
   * this screen has no trainer picker of its own (employeeId is always pinned
   * to the viewer's own id), so a null currentEmployeeId here means exactly
   * that, never "nobody picked a trainer" the way it can on the admin
   * Raspored week view. Gates showing the "dovrši profil" CTA instead of the
   * grid's own generic SELECT_TRAINER_HINT empty state, which would otherwise
   * be misleading here. */
  readonly hasEmployeeProfile = computed(() => this.currentEmployeeService.hasProfile());

  readonly activeEmployees = signal<EmployeeDirectoryDto[]>([]);
  readonly activeServices = signal<ServiceDto[]>([]);
  readonly activeLocations = signal<LocationDto[]>([]);

  readonly detailVisible = signal(false);
  readonly detailAppointmentId = signal<string | null>(null);

  readonly attendanceDialogVisible = signal(false);
  readonly attendanceGroup = signal<GroupDto | null>(null);
  readonly attendanceAppointment = signal<GroupAppointmentCellDto | null>(null);

  readonly newAppointmentVisible = signal(false);
  readonly newAppointmentInitial = signal<NewAppointmentInitial | null>(null);

  readonly breakDetailVisible = signal(false);
  readonly selectedBreakId = signal<string | null>(null);

  readonly newBreakVisible = signal(false);
  readonly newBreakInitial = signal<NewAppointmentInitial | null>(null);

  constructor() {
    this.loadActiveEmployees();
    this.loadActiveServices();
    this.loadActiveLocations();
  }

  onAppointmentClicked(appointment: AppointmentScheduleCellDto): void {
    if (appointment.form === 'Group') {
      this.openGroupAttendance(appointment);
      return;
    }
    this.detailAppointmentId.set(appointment.id);
    this.detailVisible.set(true);
  }

  onEmptySlotClick(event: { startsAt: Date; employeeId: string; companyId: string | null }): void {
    this.newAppointmentInitial.set(event);
    this.newAppointmentVisible.set(true);
  }

  openNewAppointment(): void {
    this.newAppointmentInitial.set({
      startsAt: new Date(),
      employeeId: this.currentEmployeeService.employee()?.employeeId ?? null,
      companyId: this.locationContext.selectedLocationId(),
    });
    this.newAppointmentVisible.set(true);
  }

  onBreakClicked(scheduleBreak: ScheduleBreakCellDto): void {
    this.selectedBreakId.set(scheduleBreak.id);
    this.breakDetailVisible.set(true);
  }

  openNewBreak(): void {
    this.newBreakInitial.set({
      startsAt: new Date(),
      employeeId: this.currentEmployeeService.employee()?.employeeId ?? null,
      companyId: this.locationContext.selectedLocationId(),
    });
    this.newBreakVisible.set(true);
  }

  onAttendanceVisibleChange(visible: boolean): void {
    this.attendanceDialogVisible.set(visible);
    if (!visible) {
      this.weekGrid()?.refetch();
    }
  }

  refreshGrid(): void {
    this.weekGrid()?.refetch();
  }

  private openGroupAttendance(appointment: AppointmentScheduleCellDto): void {
    if (!appointment.groupId) {
      return;
    }
    this.groupsService.getById(appointment.groupId).subscribe((group) => {
      this.attendanceGroup.set(group);
      this.attendanceAppointment.set(toGroupAppointmentCell(appointment));
      this.attendanceDialogVisible.set(true);
    });
  }

  /** GET /api/employees/directory, not getPage()/`/api/employees` - the full
   * endpoint is Admin-only and 403s for Member/Reception, who both reach this
   * page (see EmployeeDirectoryDto). */
  private loadActiveEmployees(): void {
    this.employeesService
      .getDirectory(true, { suppressErrorToast: true })
      .subscribe((result) => this.activeEmployees.set(result));
  }

  private loadActiveServices(): void {
    this.servicesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeServices.set(result.items));
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }
}
