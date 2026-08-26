import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { EmployeeDto } from '../../../../core/models/employee.model';
import { LocationDto } from '../../../../core/models/location.model';
import { RosterEntryDto, RosterTypeDto } from '../../../../core/models/roster.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../core/services/employees.service';
import { LocationsService } from '../../../../core/services/locations.service';
import { RosterEntriesService } from '../../../../core/services/roster-entries.service';
import { RosterTypesService } from '../../../../core/services/roster-types.service';
import { CompleteEmployeeProfileCtaComponent } from '../../../../shared/components/complete-employee-profile/complete-employee-profile-cta.component';
import { PersonalRosterComponent } from '../../../trainer/pages/my-shifts/personal-roster/personal-roster.component';
import { RosterEntryFormDialogComponent, RosterEntryFormInitial } from '../../../trainer/pages/my-shifts/roster-entry-form-dialog.component';
import { TeamMonthlyCellClickEvent, TeamMonthlyComponent } from '../../../trainer/pages/my-shifts/team-monthly/team-monthly.component';
import { RosterTypesComponent } from './roster-types/roster-types.component';

const LOOKUP_PAGE_SIZE = 200;
const DEFAULT_TAB = 'types';

/**
 * Admin "Roster" page - three tabs. "Vrste rostera" is the one genuinely
 * admin-only piece (RosterType write access). "Timski pregled" and "Moj
 * pregled" reuse the exact same TeamMonthlyComponent/PersonalRosterComponent/
 * RosterEntryFormDialogComponent that /app/my-shifts (MyShiftsComponent) uses
 * for the trainer-facing view of the same data - before this, Admin had no
 * visibility into the roster at all outside the trainer section. Ownership
 * behavior is unchanged: these are the same components with the same
 * isAdmin/currentEmployeeId inputs, so Admin already edits every row (see
 * TeamMonthlyComponent.isRowEditable) - only the wiring (dialog state +
 * active-lookups loading) is duplicated here, the same way every other admin
 * page re-loads its own active-employee/location lookups rather than sharing
 * a loader service.
 *
 * "Moj pregled" only makes sense if the logged-in Admin also has an Employee
 * profile (CurrentEmployeeService.hasProfile()) - an Owner/Admin account
 * without one (see CurrentEmployeeService's doc) has no personal roster to
 * show, so the tab is hidden rather than showing an empty/broken view.
 */
@Component({
  selector: 'app-admin-shifts',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    RosterTypesComponent,
    TeamMonthlyComponent,
    PersonalRosterComponent,
    RosterEntryFormDialogComponent,
    CompleteEmployeeProfileCtaComponent,
  ],
  templateUrl: './shifts.component.html',
})
export class ShiftsComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly rosterTypesService = inject(RosterTypesService);
  private readonly rosterEntriesService = inject(RosterEntriesService);
  private readonly locationsService = inject(LocationsService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  readonly initialTab = DEFAULT_TAB;

  readonly teamMonthly = viewChild(TeamMonthlyComponent);
  readonly personalRoster = viewChild(PersonalRosterComponent);

  readonly activeEmployees = signal<EmployeeDto[]>([]);
  readonly activeRosterTypes = signal<RosterTypeDto[]>([]);
  readonly activeLocations = signal<LocationDto[]>([]);

  readonly currentEmployeeId = computed(() => this.currentEmployeeService.employee()?.employeeId ?? null);
  readonly hasEmployeeProfile = computed(() => this.currentEmployeeService.hasProfile());

  readonly dialogVisible = signal(false);
  readonly editingEntry = signal<RosterEntryDto | null>(null);
  readonly dialogInitial = signal<RosterEntryFormInitial | null>(null);

  constructor() {
    this.loadActiveEmployees();
    this.loadActiveRosterTypes();
    this.loadActiveLocations();
  }

  onTeamCellClick(event: TeamMonthlyCellClickEvent): void {
    if (event.entryId) {
      this.rosterEntriesService.getById(event.entryId).subscribe((entry) => {
        this.editingEntry.set(entry);
        this.dialogInitial.set(null);
        this.dialogVisible.set(true);
      });
      return;
    }
    this.editingEntry.set(null);
    this.dialogInitial.set({
      employeeId: event.employeeId,
      date: event.date,
      startTime: event.plannedInterval?.start,
      endTime: event.plannedInterval?.end,
    });
    this.dialogVisible.set(true);
  }

  onPersonalAdd(event: { employeeId: string; date: Date }): void {
    this.editingEntry.set(null);
    this.dialogInitial.set(event);
    this.dialogVisible.set(true);
  }

  onPersonalEdit(entry: RosterEntryDto): void {
    this.editingEntry.set(entry);
    this.dialogInitial.set(null);
    this.dialogVisible.set(true);
  }

  onDialogSaved(): void {
    this.teamMonthly()?.refetch();
    this.personalRoster()?.refetch();
  }

  private loadActiveEmployees(): void {
    this.employeesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeEmployees.set(result.items));
  }

  private loadActiveRosterTypes(): void {
    this.rosterTypesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeRosterTypes.set(result.items));
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }
}
