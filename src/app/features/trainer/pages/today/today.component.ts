import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { APPOINTMENT_STATUSES, AppointmentScheduleCellDto, AppointmentStatus, appointmentStatusTranslationKey } from '../../../../core/models/appointment.model';
import { EmployeeColumnEntry, EmployeeDirectoryDto } from '../../../../core/models/employee.model';
import { GroupAppointmentCellDto, GroupDto } from '../../../../core/models/group.model';
import { LocationDto } from '../../../../core/models/location.model';
import { ServiceCategoryDto } from '../../../../core/models/service-category.model';
import { ServiceDto } from '../../../../core/models/service.model';
import { EmployeesService } from '../../../../core/services/employees.service';
import { GroupsService } from '../../../../core/services/groups.service';
import { LocationContextService } from '../../../../core/services/location-context.service';
import { LocationsService } from '../../../../core/services/locations.service';
import { ServiceCategoriesService } from '../../../../core/services/service-categories.service';
import { ServicesService } from '../../../../core/services/services.service';
import { translationReadySignal } from '../../../../core/utils/translation-signal.util';
import { AppointmentDetailDialogComponent } from '../../../../shared/components/appointment-detail-dialog/appointment-detail-dialog.component';
import { NewAppointmentDialogComponent, NewAppointmentInitial } from '../../../../shared/components/new-appointment-dialog/new-appointment-dialog.component';
import { toGroupAppointmentCell } from '../../../../shared/components/schedule-grid/schedule-cell-view.util';
import { ScheduleLegendComponent } from '../../../../shared/components/schedule-legend/schedule-legend.component';
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
  private readonly locationContext = inject(LocationContextService);
  private readonly locationsService = inject(LocationsService);
  private readonly serviceCategoriesService = inject(ServiceCategoriesService);
  private readonly servicesService = inject(ServicesService);
  private readonly translate = inject(TranslateService);

  readonly dayGrid = viewChild<ScheduleDayGridComponent>('dayGrid');

  readonly statusFilter = signal<AppointmentStatus | null>(null);
  readonly serviceCategoryFilter = signal<string | null>(null);
  readonly serviceFilter = signal<string | null>(null);

  readonly activeEmployees = signal<EmployeeDirectoryDto[]>([]);
  readonly activeServiceCategories = signal<ServiceCategoryDto[]>([]);
  readonly activeServices = signal<ServiceDto[]>([]);
  readonly activeLocations = signal<LocationDto[]>([]);

  readonly detailVisible = signal(false);
  readonly detailAppointmentId = signal<string | null>(null);

  readonly attendanceDialogVisible = signal(false);
  readonly attendanceGroup = signal<GroupDto | null>(null);
  readonly attendanceAppointment = signal<GroupAppointmentCellDto | null>(null);

  readonly newAppointmentVisible = signal(false);
  readonly newAppointmentInitial = signal<NewAppointmentInitial | null>(null);

  private readonly translationsReady = translationReadySignal(this.translate);

  /** ScheduleDayGridComponent's columns need per-location ids to filter by the
   * globally-selected location - EmployeeDirectoryDto only carries location
   * NAMES (no ids, see its own doc comment), so this resolves each name
   * against the already-fetched activeLocations() list before handing the
   * grid anything. A name with no match (shouldn't happen - the directory and
   * locations endpoints describe the same studio) is simply dropped rather
   * than crashing. */
  readonly employeeColumns = computed<EmployeeColumnEntry[]>(() => {
    const locationIdByName = new Map(this.activeLocations().map((location) => [location.name, location.id]));
    return this.activeEmployees().map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      locationIds: employee.locations
        .map((name) => locationIdByName.get(name))
        .filter((id): id is string => id !== undefined),
    }));
  });

  readonly statusFilterOptions = computed<FilterOption<AppointmentStatus>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('SCHEDULE.FILTER_STATUS_ALL'), value: null },
      ...APPOINTMENT_STATUSES.map((status) => ({
        label: this.translate.instant(appointmentStatusTranslationKey(status)),
        value: status,
      })),
    ];
  });

  readonly serviceCategoryFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('SCHEDULE.FILTER_CATEGORY_ALL'), value: null },
      ...this.activeServiceCategories().map((category) => ({ label: category.name, value: category.id })),
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
    this.loadActiveServiceCategories();
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

  onEmptySlotClick(event: { startsAt: Date; employeeId: string; locationId: string | null }): void {
    this.newAppointmentInitial.set(event);
    this.newAppointmentVisible.set(true);
  }

  openNewAppointment(): void {
    this.newAppointmentInitial.set({ startsAt: new Date(), employeeId: null, locationId: this.locationContext.selectedLocationId() });
    this.newAppointmentVisible.set(true);
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

  private loadActiveServiceCategories(): void {
    this.serviceCategoriesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeServiceCategories.set(result.items));
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
