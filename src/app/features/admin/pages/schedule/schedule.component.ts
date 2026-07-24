import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { APPOINTMENT_STATUSES, AppointmentScheduleCellDto, AppointmentStatus, appointmentStatusTranslationKey } from '../../../../core/models/appointment.model';
import { EmployeeDto } from '../../../../core/models/employee.model';
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
import { ScheduleWeekGridComponent } from '../../../../shared/components/schedule-week-grid/schedule-week-grid.component';
import { GroupAttendanceDialogComponent } from '../groups/attendance/group-attendance-dialog.component';
import { ScheduleDayGridComponent } from './schedule-day-grid/schedule-day-grid.component';

const LOOKUP_PAGE_SIZE = 200;

type ViewMode = 'day' | 'week';

interface FilterOption<T> {
  label: string;
  value: T | null;
}

/**
 * Admin "Raspored" - grid A (day x every trainer) by default, switchable to
 * grid B (week x days) for a single chosen trainer. Both grids share the
 * status/service/category filters and the category legend defined here;
 * location itself is the global topbar switcher (LocationContextService),
 * not a filter owned by this page - see ScheduleDayGridComponent/
 * ScheduleWeekGridComponent, which each react to it directly.
 *
 * Owns every dialog either grid's clicks can open: a click on an existing
 * Individual termin opens AppointmentDetailDialogComponent (move/naplata/
 * cancel/no-show all live there); a Group one opens GroupAttendanceDialogComponent
 * (the same one used from the group detail page) after resolving its group
 * via GroupsService, since the schedule cell only carries `groupId`, not the
 * group's serviceId the dialog needs for eligible-package lookups. A click on
 * *empty* grid space (`emptySlotClick`) or the toolbar's "Novi termin" button
 * both open NewAppointmentDialogComponent, prefilled from the click's
 * date/trainer/location where there is one. `#dayGrid`/`#weekGrid` let this
 * component call `refetch()` back on whichever grid is currently rendered
 * once any of these dialogs closes.
 */
@Component({
  selector: 'app-admin-schedule',
  imports: [
    ScheduleDayGridComponent,
    ScheduleWeekGridComponent,
    ScheduleLegendComponent,
    AppointmentDetailDialogComponent,
    GroupAttendanceDialogComponent,
    NewAppointmentDialogComponent,
    Select,
    Button,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly groupsService = inject(GroupsService);
  private readonly locationContext = inject(LocationContextService);
  private readonly locationsService = inject(LocationsService);
  private readonly serviceCategoriesService = inject(ServiceCategoriesService);
  private readonly servicesService = inject(ServicesService);
  private readonly translate = inject(TranslateService);

  readonly dayGrid = viewChild<ScheduleDayGridComponent>('dayGrid');
  readonly weekGrid = viewChild<ScheduleWeekGridComponent>('weekGrid');

  readonly viewMode = signal<ViewMode>('day');
  readonly selectedTrainerId = signal<string | null>(null);

  readonly statusFilter = signal<AppointmentStatus | null>(null);
  readonly serviceCategoryFilter = signal<string | null>(null);
  readonly serviceFilter = signal<string | null>(null);

  readonly activeEmployees = signal<EmployeeDto[]>([]);
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

  readonly trainerOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return this.activeEmployees().map((employee) => ({
      label: `${employee.firstName} ${employee.lastName}`,
      value: employee.id,
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

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  /** The single handler both grids' `appointmentClicked` bind to - routes to
   * whichever dialog fits the appointment's form. */
  onAppointmentClicked(appointment: AppointmentScheduleCellDto): void {
    if (appointment.form === 'Group') {
      this.openGroupAttendance(appointment);
      return;
    }
    this.detailAppointmentId.set(appointment.id);
    this.detailVisible.set(true);
  }

  /** Bound to both grids' `emptySlotClick` - the day grid's column is a
   * trainer (so employeeId comes straight from the click), the week grid's
   * column is a day (its own employeeId is the single trainer the grid is
   * already scoped to) - either way the event carries the same three fields,
   * see DayEmptySlotEvent/WeekEmptySlotEvent. */
  onEmptySlotClick(event: { startsAt: Date; employeeId: string; locationId: string | null }): void {
    this.newAppointmentInitial.set(event);
    this.newAppointmentVisible.set(true);
  }

  /** "Novi termin" toolbar button - no cell context, so only startsAt (now)
   * and the global location switcher's current selection are prefilled. */
  openNewAppointment(): void {
    this.newAppointmentInitial.set({ startsAt: new Date(), employeeId: null, locationId: this.locationContext.selectedLocationId() });
    this.newAppointmentVisible.set(true);
  }

  onAttendanceVisibleChange(visible: boolean): void {
    this.attendanceDialogVisible.set(visible);
    if (!visible) {
      this.refreshActiveGrid();
    }
  }

  /** Called after AppointmentDetailDialogComponent's move form saves - the
   * dialog's own `saved` output only fires on an actual change, unlike the
   * attendance dialog's close-always refresh above. */
  refreshActiveGrid(): void {
    this.dayGrid()?.refetch();
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

  private loadActiveEmployees(): void {
    this.employeesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeEmployees.set(result.items));
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
