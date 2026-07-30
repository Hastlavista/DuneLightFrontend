import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { EmployeeDirectoryDto } from '../../../../core/models/employee.model';
import { LocationDto } from '../../../../core/models/location.model';
import { RosterEntryDto, RosterTypeDto } from '../../../../core/models/roster.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../core/services/employees.service';
import { LocationsService } from '../../../../core/services/locations.service';
import { RosterEntriesService } from '../../../../core/services/roster-entries.service';
import { RosterTypesService } from '../../../../core/services/roster-types.service';
import { PersonalRosterComponent } from './personal-roster/personal-roster.component';
import { RosterEntryFormDialogComponent, RosterEntryFormInitial } from './roster-entry-form-dialog.component';
import { TeamMonthlyCellClickEvent, TeamMonthlyComponent } from './team-monthly/team-monthly.component';

const LOOKUP_PAGE_SIZE = 200;
const DEFAULT_TAB = 'team';

/**
 * "Moje smjene" nav entry, repurposed as Roster (frontend #11)'s main screen -
 * reachable by any authenticated role (authGuard only, no adminGuard), which
 * is exactly why the team-monthly matrix and personal view live here rather
 * than under /admin: both must be visible to Member too, and /admin is
 * Admin-only. Owns the one entry-form dialog both tabs share (mirrors
 * ScheduleComponent owning dialogs both grids open), plus the active
 * employees/roster-types/locations lookups the dialog and the two tabs need.
 */
@Component({
  selector: 'app-trainer-my-shifts',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    TeamMonthlyComponent,
    PersonalRosterComponent,
    RosterEntryFormDialogComponent,
  ],
  templateUrl: './my-shifts.component.html',
})
export class MyShiftsComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly rosterTypesService = inject(RosterTypesService);
  private readonly rosterEntriesService = inject(RosterEntriesService);
  private readonly locationsService = inject(LocationsService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  readonly initialTab = DEFAULT_TAB;

  readonly teamMonthly = viewChild(TeamMonthlyComponent);
  readonly personalRoster = viewChild(PersonalRosterComponent);

  readonly activeEmployees = signal<EmployeeDirectoryDto[]>([]);
  readonly activeRosterTypes = signal<RosterTypeDto[]>([]);
  readonly activeLocations = signal<LocationDto[]>([]);

  readonly isAdmin = computed(() => this.currentEmployeeService.employee()?.role === 'Admin');
  readonly currentEmployeeId = computed(() => this.currentEmployeeService.employee()?.employeeId ?? null);

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
    this.dialogInitial.set({ employeeId: event.employeeId, date: event.date });
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

  /** GET /api/employees/directory, not getPage()/`/api/employees` - the full
   * endpoint is Admin-only and 403s for Member/Reception, who both reach this
   * page (see EmployeeDirectoryDto). */
  private loadActiveEmployees(): void {
    this.employeesService
      .getDirectory(true, { suppressErrorToast: true })
      .subscribe((result) => this.activeEmployees.set(result));
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
