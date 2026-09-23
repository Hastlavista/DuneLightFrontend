import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { AppointmentScheduleCellDto } from '../../../../core/models/appointment.model';
import { EmployeeDirectoryDto } from '../../../../core/models/employee.model';
import { GroupAppointmentCellDto, GroupDto } from '../../../../core/models/group.model';
import { ScheduleBreakCellDto } from '../../../../core/models/schedule-break.model';
import { AppointmentServiceOptionDto } from '../../../../core/models/appointment.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../core/services/employees.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { AppointmentsService } from '../../../../core/services/appointments.service';
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
  private readonly companyContext = inject(CompanyContextService);
  private readonly appointmentsService = inject(AppointmentsService);

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

  /** Gates "Novi termin" (toolbar button + empty-slot click) - a view-only
   * Raspored user has no reason to see a create entry point they can't
   * actually submit; the backend would just 403 the create call. */
  readonly canCreateAppointments = computed(() => this.currentEmployeeService.can('appointments.manage'));

  /** Same rationale as canCreateAppointments() - gates "+ Pauza". */
  readonly canCreateBreaks = computed(() => this.currentEmployeeService.can('schedule-breaks.manage'));

  readonly activeEmployees = signal<EmployeeDirectoryDto[]>([]);
  readonly activeServices = signal<AppointmentServiceOptionDto[]>([]);
  readonly activeCompanies = this.companyContext.companies;

  /** Companies for the grid's color banner and the required companyId
   * dropdowns in "Novi termin", the detail dialog's move form and the break
   * form: the full active list with catalog.companies.view, otherwise the
   * viewer's own assigned companies (GET /api/catalog/companies would 403). */
  readonly dialogCompanies = this.companyContext.companies;

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
    effect(() => {
      const companyId = this.companyContext.selectedCompanyId();
      this.loadActiveServices(companyId);
    });
    if (!this.companyContext.companies().length) {
      this.companyContext.loadCompanies();
    }
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
    if (!this.canCreateAppointments()) {
      return;
    }
    this.newAppointmentInitial.set(event);
    this.newAppointmentVisible.set(true);
  }

  openNewAppointment(): void {
    if (!this.canCreateAppointments()) {
      return;
    }
    this.newAppointmentInitial.set({
      startsAt: new Date(),
      employeeId: this.currentEmployeeService.employee()?.employeeId ?? null,
      companyId: this.companyContext.selectedCompanyId(),
    });
    this.newAppointmentVisible.set(true);
  }

  onBreakClicked(scheduleBreak: ScheduleBreakCellDto): void {
    this.selectedBreakId.set(scheduleBreak.id);
    this.breakDetailVisible.set(true);
  }

  openNewBreak(): void {
    if (!this.canCreateBreaks()) {
      return;
    }
    this.newBreakInitial.set({
      startsAt: new Date(),
      employeeId: this.currentEmployeeService.employee()?.employeeId ?? null,
      companyId: this.companyContext.selectedCompanyId(),
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

  /** Feeds only "Novi termin"'s required serviceId dropdown - this page has no
   * service filter of its own (unlike Today/admin Raspored), so unlike those
   * screens this must never be skipped for catalog.services.view: booking a
   * termin isn't "browsing the catalog", and a custom GrantGroup lacking that
   * grant would otherwise leave the dropdown silently empty. */
  private loadActiveServices(companyId: string | null): void {
    if (!companyId) {
      this.activeServices.set([]);
      return;
    }
    this.appointmentsService
      .getServices(companyId, { suppressErrorToast: true })
      .subscribe({ next: (services) => this.activeServices.set(services), error: () => this.activeServices.set([]) });
  }

}
