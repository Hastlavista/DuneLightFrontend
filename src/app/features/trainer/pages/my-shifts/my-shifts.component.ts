import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { EmployeeDirectoryDto } from '../../../../core/models/employee.model';
import { RosterEntryDto, RosterTypeDto } from '../../../../core/models/roster.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../core/services/employees.service';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { RosterEntriesService } from '../../../../core/services/roster-entries.service';
import { RosterTypesService } from '../../../../core/services/roster-types.service';
import { CompleteEmployeeProfileCtaComponent } from '../../../../shared/components/complete-employee-profile/complete-employee-profile-cta.component';
import { PersonalRosterComponent } from './personal-roster/personal-roster.component';
import { RosterEntryFormDialogComponent, RosterEntryFormInitial } from './roster-entry-form-dialog.component';
import { TeamMonthlyCellClickEvent, TeamMonthlyComponent } from './team-monthly/team-monthly.component';

const LOOKUP_PAGE_SIZE = 200;
const DEFAULT_TAB = 'team';

/**
 * "Moje smjene" nav entry, repurposed as Roster (frontend #11)'s main screen -
 * has no requiredGrants (see nav-items.ts), so both the team-monthly matrix
 * and personal view are visible to every employee, not just grant-holders.
 * Owns the one entry-form dialog both tabs share (mirrors
 * ScheduleComponent owning dialogs both grids open), plus the active
 * employees/roster-types/companies lookups the dialog and the two tabs need.
 *
 * "Moj pregled" is hidden when the viewer has no Employee profile - same
 * reasoning as ShiftsComponent's hasEmployeeProfile: an Owner/Admin account
 * without one (see CurrentEmployeeService's doc) has no personal roster to
 * show, so the tab must not render a permanently-inert "+"/"Primijeni" (both
 * silently no-op on a null currentEmployeeId - see PersonalRosterComponent).
 * "Timski pregled" stays visible regardless - it degrades fine (the viewer
 * just won't have their own row, since they have no Employee record).
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
    CompleteEmployeeProfileCtaComponent,
  ],
  templateUrl: './my-shifts.component.html',
})
export class MyShiftsComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly rosterTypesService = inject(RosterTypesService);
  private readonly rosterEntriesService = inject(RosterEntriesService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  readonly initialTab = DEFAULT_TAB;

  readonly teamMonthly = viewChild(TeamMonthlyComponent);
  readonly personalRoster = viewChild(PersonalRosterComponent);

  readonly activeEmployees = signal<EmployeeDirectoryDto[]>([]);
  readonly activeRosterTypes = signal<RosterTypeDto[]>([]);
  /** Team-monthly's company filter: the full active list with catalog.companies.view,
   * otherwise the viewer's assigned companies (GET /api/catalog/companies would 403). */
  readonly activeCompanies = this.companyContext.companies;

  readonly currentEmployeeId = computed(() => this.currentEmployeeService.employee()?.employeeId ?? null);
  readonly hasEmployeeProfile = computed(() => this.currentEmployeeService.hasProfile());

  readonly dialogVisible = signal(false);
  readonly editingEntry = signal<RosterEntryDto | null>(null);
  readonly dialogInitial = signal<RosterEntryFormInitial | null>(null);

  constructor() {
    this.loadActiveEmployees();
    this.loadActiveRosterTypes();
    if (!this.companyContext.companies().length) {
      this.companyContext.loadCompanies();
    }
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

  /** GET /api/employees/directory, not getPage()/`/api/employees` - the full
   * endpoint is Admin-only and 403s for Member/Reception, who both reach this
   * page (see EmployeeDirectoryDto). */
  private loadActiveEmployees(): void {
    this.employeesService
      .getDirectory(true, { suppressErrorToast: true })
      .subscribe((result) => this.activeEmployees.set(result));
  }

  /** Feeds the entry-form dialog's required roster-type dropdown - this page
   * has no filter of its own for this list, so unlike an admin-only screen
   * this must never be skipped for roster.types.view: logging a shift isn't
   * "browsing the catalog", and a custom GrantGroup lacking that grant would
   * otherwise leave the dropdown silently empty. */
  private loadActiveRosterTypes(): void {
    this.rosterTypesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeRosterTypes.set(result.items));
  }
}
