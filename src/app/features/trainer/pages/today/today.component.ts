import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { APPOINTMENT_STATUSES, AppointmentScheduleCellDto, AppointmentStatus, appointmentStatusTranslationKey } from '../../../../core/models/appointment.model';
import { EmployeeColumnEntry, EmployeeDirectoryDto } from '../../../../core/models/employee.model';
import { GroupAppointmentCellDto, GroupDto } from '../../../../core/models/group.model';
import { ScheduleBreakCellDto } from '../../../../core/models/schedule-break.model';
import { EXECUTION_MODES, ServiceDto, ServiceExecutionMode, executionModeTranslationKey } from '../../../../core/models/service.model';
import { AppointmentServiceOptionDto } from '../../../../core/models/appointment.model';
import { AppointmentsService } from '../../../../core/services/appointments.service';
import { EmployeesService } from '../../../../core/services/employees.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { ServicesService } from '../../../../core/services/services.service';
import { translationReadySignal } from '../../../../core/utils/translation-signal.util';
import { AppointmentDetailDialogComponent } from '../../../../shared/components/appointment-detail-dialog/appointment-detail-dialog.component';
import { NewAppointmentDialogComponent, NewAppointmentInitial } from '../../../../shared/components/new-appointment-dialog/new-appointment-dialog.component';
import { toGroupAppointmentCell } from '../../../../shared/components/schedule-grid/schedule-cell-view.util';
import { ScheduleLegendComponent } from '../../../../shared/components/schedule-legend/schedule-legend.component';
import { ScheduleBreakDialogComponent } from '../../../../shared/components/schedule-break-dialog/schedule-break-dialog.component';
import { ScheduleBreakFormDialogComponent } from '../../../../shared/components/schedule-break-form-dialog/schedule-break-form-dialog.component';
import { GroupAttendanceDialogComponent } from '../../../admin/pages/groups/attendance/group-attendance-dialog.component';
import { ScheduleDayGridComponent } from '../../../admin/pages/schedule/schedule-day-grid/schedule-day-grid.component';

const LOOKUP_PAGE_SIZE = 200;

interface FilterOption<T> {
  label: string;
  value: T | null;
}

/**
 * "Danas — svi" - almost a literal reuse of admin Raspored's day view
 * (ScheduleDayGridComponent, grid A: day x every trainer), same filters and
 * dialog wiring as ScheduleComponent's day mode 1:1 - no trainer-scoped
 * visibility restriction, a trainer sees the same full details here an admin
 * would. The one deliberate difference: no view-mode toggle/trainer picker
 * (this screen is day-only), and the grid's own `selectedDate` always starts
 * at today on every visit since nothing here persists it across navigations.
 */
@Component({
  selector: 'app-trainer-today',
  imports: [
    ScheduleDayGridComponent,
    ScheduleLegendComponent,
    AppointmentDetailDialogComponent,
    GroupAttendanceDialogComponent,
    NewAppointmentDialogComponent,
    ScheduleBreakDialogComponent,
    ScheduleBreakFormDialogComponent,
    Select,
    Button,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly groupsService = inject(GroupsService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly servicesService = inject(ServicesService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly translate = inject(TranslateService);

  readonly dayGrid = viewChild<ScheduleDayGridComponent>('dayGrid');

  readonly statusFilter = signal<AppointmentStatus | null>(null);
  readonly executionModeFilter = signal<ServiceExecutionMode | null>(null);
  readonly serviceFilter = signal<string | null>(null);

  readonly activeEmployees = signal<EmployeeDirectoryDto[]>([]);
  readonly activeServices = signal<ServiceDto[]>([]);
  readonly activeCompanies = this.companyContext.companies;

  /** Services for "Novi termin"'s own required serviceId dropdown - via
   * GET /api/appointments/services (appointments.write.own/all), NOT
   * ServicesService/catalog.services.view: booking a termin isn't "browsing
   * the catalog", so it must not go empty just because a custom GrantGroup
   * doesn't happen to include that grant. Scoped to the topbar-selected
   * company, same as the dialog's own default companyId. */
  readonly dialogServices = signal<AppointmentServiceOptionDto[]>([]);

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

  private readonly translationsReady = translationReadySignal(this.translate);

  /** Gates "Novi termin" (toolbar button + empty-slot click) - a view-only
   * Raspored user has no reason to see a create entry point they can't
   * actually submit; the backend would just 403 the create call. */
  readonly canCreateAppointments = computed(() => this.currentEmployeeService.can('appointments.manage'));

  /** Same rationale as canCreateAppointments() - gates "+ Pauza". */
  readonly canCreateBreaks = computed(() => this.currentEmployeeService.can('schedule-breaks.manage'));

  /** ScheduleDayGridComponent's columns filter by company NAME, not id (see
   * EmployeeColumnEntry's doc comment) - EmployeeDirectoryDto.companies is
   * already a plain name array, so this needs no join against
   * activeCompanies() at all, unlike the old id-based version. That matters
   * here specifically: activeCompanies() is only fetched when the viewer
   * holds `catalog.companies.view` (see loadActiveCompanies below), which
   * Reception isn't guaranteed to have - an id-based join would silently
   * resolve to zero columns for that role whenever the grant is absent. */
  readonly employeeColumns = computed<EmployeeColumnEntry[]>(() =>
    this.activeEmployees().map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      companyNames: employee.companies,
    })),
  );

  /** Excludes `Cancelled` - a cancelled termin never renders on the grid
   * regardless of this filter (see ScheduleDayGridComponent's `gridCells`),
   * so offering it as a filter value would just produce a silently empty
   * grid. */
  readonly statusFilterOptions = computed<FilterOption<AppointmentStatus>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('SCHEDULE.FILTER_STATUS_ALL'), value: null },
      ...APPOINTMENT_STATUSES.filter((status) => status !== 'Cancelled').map((status) => ({
        label: this.translate.instant(appointmentStatusTranslationKey(status)),
        value: status,
      })),
    ];
  });

  readonly executionModeFilterOptions = computed<FilterOption<ServiceExecutionMode>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('SCHEDULE.FILTER_EXECUTION_MODE_ALL'), value: null },
      ...EXECUTION_MODES.map((mode) => ({ label: this.translate.instant(executionModeTranslationKey(mode)), value: mode })),
    ];
  });

  readonly serviceFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('SCHEDULE.FILTER_SERVICE_ALL'), value: null },
      ...this.activeServices().map((service) => ({ label: service.name, value: service.id })),
    ];
  });

  constructor() {
    this.loadActiveEmployees();
    // A hard refresh straight into this (deliberately ungated) trainer route
    // constructs this component before CurrentEmployeeService's /me resolves -
    // a one-time hasGrant() check in the constructor would see "not loaded yet"
    // (false) and never retry. React to the employee actually loading instead.
    effect(() => {
      if (this.currentEmployeeService.hasGrant('catalog.services.view')) {
        this.loadActiveServices();
      }
    });
    if (!this.companyContext.companies().length) {
      this.companyContext.loadCompanies();
    }
    effect(() => {
      const companyId = this.companyContext.selectedCompanyId();
      this.loadDialogServices(companyId);
    });
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
    this.newAppointmentInitial.set({ startsAt: new Date(), employeeId: null, companyId: this.companyContext.selectedCompanyId() });
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
    this.newBreakInitial.set({ startsAt: new Date(), employeeId: null, companyId: this.companyContext.selectedCompanyId() });
    this.newBreakVisible.set(true);
  }

  onAttendanceVisibleChange(visible: boolean): void {
    this.attendanceDialogVisible.set(visible);
    if (!visible) {
      this.dayGrid()?.refetch();
    }
  }

  refreshGrid(): void {
    this.dayGrid()?.refetch();
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

  /** GET /api/catalog/services requires catalog.services.view - the default
   * Trener GrantGroup includes it, but a custom one might not. Skip the call
   * entirely rather than firing a request the current grants can't pass; the
   * service filter simply stays empty for that edge case. */
  private loadActiveServices(): void {
    if (!this.currentEmployeeService.hasGrant('catalog.services.view')) {
      return;
    }
    this.servicesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeServices.set(result.items));
  }

  /** Feeds only "Novi termin"'s required serviceId dropdown - always called,
   * regardless of catalog.services.view (see dialogServices' doc). */
  private loadDialogServices(companyId: string | null): void {
    if (!companyId) {
      this.dialogServices.set([]);
      return;
    }
    this.appointmentsService
      .getServices(companyId, { suppressErrorToast: true })
      .subscribe({ next: (services) => this.dialogServices.set(services), error: () => this.dialogServices.set([]) });
  }

}
