import { Component, inject, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { By } from '@angular/platform-browser';
import { CurrentEmployee } from '../../../../core/models/employee.model';
import { RosterEntryDto, RosterTypeDto, TeamMonthlyDto } from '../../../../core/models/roster.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { RosterEntriesService } from '../../../../core/services/roster-entries.service';
import { RosterEntryFormDialogComponent, RosterEntryFormInitial } from './roster-entry-form-dialog.component';
import { TeamMonthlyCellClickEvent, TeamMonthlyComponent } from './team-monthly/team-monthly.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

const ROSTER_TYPE: RosterTypeDto = {
  id: 'type-1',
  name: 'Rad',
  colorHex: '#336699',
  countsAsWork: true,
  isAbsence: false,
  requiresTime: true,
  deductsFromLeaveFund: false,
  isActive: true,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: null,
  updatedAt: null,
  updatedBy: null,
};

@Component({
  standalone: true,
  imports: [TeamMonthlyComponent, RosterEntryFormDialogComponent],
  template: `
    <app-roster-team-monthly
      [currentEmployeeId]="null"
      [activeCompanies]="[]"
      (cellClick)="onTeamCellClick($event)"
    />
    <app-roster-entry-form-dialog
      [(visible)]="dialogVisible"
      [entry]="editingEntry()"
      [initial]="dialogInitial()"
      [employees]="[]"
      [rosterTypes]="rosterTypes"
      [currentEmployeeId]="null"
      (saved)="onSaved()"
    />
  `,
})
class HostComponent {
  private readonly rosterEntriesService = inject(RosterEntriesService);

  readonly rosterTypes: RosterTypeDto[] = [ROSTER_TYPE];
  readonly dialogVisible = signal(false);
  readonly editingEntry = signal<RosterEntryDto | null>(null);
  readonly dialogInitial = signal<RosterEntryFormInitial | null>(null);

  // Mirrors MyShiftsComponent.onTeamCellClick / ShiftsComponent.onTeamCellClick exactly.
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

  onSaved(): void {}
}

function me(role: CurrentEmployee['role'], grants: string[], employeeId = 'me-1'): CurrentEmployee {
  return { hasProfile: true, employeeId, firstName: 'Ana', lastName: 'Test', role, grants, colorHex: null, companies: [], hasPinSet: false };
}

const emptyDays = () =>
  Array.from({ length: 31 }, (_, i) => ({ day: i + 1, source: 'None' as const, plannedIntervals: [], entries: [] }));

/** Renders the host for `viewer` - its grants decide roster write scope, never
 * the legacy role - with emp-1 (entry on day 24, planned day 25) and emp-2. */
async function setUp(viewer: CurrentEmployee): Promise<{ fixture: ComponentFixture<HostComponent>; httpMock: HttpTestingController }> {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ConfirmationService,
      MessageService,
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(CurrentEmployeeService).load().subscribe();
  httpMock.expectOne((r) => r.url.endsWith('/api/employees/me')).flush(viewer);

  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  const teamMonthlyReq = httpMock.expectOne((r) => r.url.includes('/api/roster/team-monthly'));
  const dto: TeamMonthlyDto = {
    year: 2026,
    month: 8,
    employees: [
      {
        employeeId: 'emp-1',
        employeeName: 'Anea Carić',
        workHoursByType: [],
        totalWorkHours: 8,
        absenceDaysByType: [],
        days: Array.from({ length: 31 }, (_, i) => ({
          day: i + 1,
          source: 'None' as const,
          plannedIntervals: [],
          entries:
            i + 1 === 24
              ? [
                  {
                    rosterEntryId: 'entry-1',
                    rosterTypeId: 'type-1',
                    rosterTypeName: 'Rad',
                    rosterTypeColorHex: '#336699',
                    isAbsence: false,
                    hours: 8,
                    timeRange: '13:00-21:00',
                  },
                ]
              : [],
        })),
      },
      { employeeId: 'emp-2', employeeName: 'Bruno Babić', workHoursByType: [], totalWorkHours: 0, absenceDaysByType: [], days: emptyDays() },
    ],
  };
  // Day 24 must report source Actual per the RosterDaySource contract.
  dto.employees[0].days[23].source = 'Actual';
  // Day 25 - a WorkingHoursTemplate projection with no real entry yet.
  dto.employees[0].days[24].source = 'Planned';
  dto.employees[0].days[24].plannedIntervals = [{ start: '09:00:00', end: '17:00:00' }];
  teamMonthlyReq.flush(dto);
  fixture.detectChanges();
  return { fixture, httpMock };
}

const dialogOf = (fixture: ComponentFixture<HostComponent>) =>
  fixture.debugElement.query(By.directive(RosterEntryFormDialogComponent)).componentInstance as RosterEntryFormDialogComponent;
const teamMonthlyOf = (fixture: ComponentFixture<HostComponent>) =>
  fixture.debugElement.query(By.directive(TeamMonthlyComponent)).componentInstance as TeamMonthlyComponent;
const EMP2_DAY1 = 31;

describe('Roster write scope (grant-only, mirrors RosterEntryService.ValidateOwnership)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('legacy role Admin WITHOUT a roster write grant gains no write behavior', async () => {
    const { fixture } = await setUp(me('Admin', ['roster.entries.view'], 'emp-1'));

    expect(teamMonthlyOf(fixture).isRowEditable('emp-1')).toBe(false);
    expect(teamMonthlyOf(fixture).isRowEditable('emp-2')).toBe(false);
    expect(dialogOf(fixture).hasFullRosterScope()).toBe(false);

    fixture.debugElement.queryAll(By.css('.team-monthly__day-cell'))[0].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.dialogVisible()).toBe(false);
  });

  it('whatever grant group carries roster.entries.write.all (legacy role Member here) may write every row and pick the employee', async () => {
    const { fixture } = await setUp(me('Member', ['roster.entries.view', 'roster.entries.write.all'], 'emp-1'));

    expect(teamMonthlyOf(fixture).isRowEditable('emp-2')).toBe(true);
    expect(dialogOf(fixture).hasFullRosterScope()).toBe(true);

    fixture.debugElement.queryAll(By.css('.team-monthly__day-cell'))[EMP2_DAY1].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.dialogVisible()).toBe(true);
    expect(dialogOf(fixture).employeeLocked()).toBe(false);
    expect(dialogOf(fixture).form.controls.employeeId.value).toBe('emp-2');
  });

  it('roster.entries.write.own (even with legacy role Admin) may write only its own row, and the dialog is locked to self', async () => {
    const { fixture } = await setUp(me('Admin', ['roster.entries.view', 'roster.entries.write.own'], 'emp-1'));

    expect(teamMonthlyOf(fixture).isRowEditable('emp-1')).toBe(true);
    expect(teamMonthlyOf(fixture).isRowEditable('emp-2')).toBe(false);

    const cells = fixture.debugElement.queryAll(By.css('.team-monthly__day-cell'));
    cells[EMP2_DAY1].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.dialogVisible()).toBe(false);

    cells[0].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.dialogVisible()).toBe(true);
    expect(dialogOf(fixture).employeeLocked()).toBe(true);
  });
});

describe('TeamMonthly -> RosterEntryFormDialog click-to-edit wiring', () => {
  let fixture: ComponentFixture<HostComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    ({ fixture, httpMock } = await setUp(me('Member', ['roster.entries.view', 'roster.entries.write.all'])));
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('clicking a cell that already has an entry opens EDIT mode, not create mode', () => {
    const entrySpan = fixture.debugElement.query(By.css('.team-monthly__entry'));
    expect(entrySpan).toBeTruthy();
    expect(entrySpan.nativeElement.getAttribute('title')).toContain('13:00-21:00');

    entrySpan.nativeElement.click();
    fixture.detectChanges();

    const getByIdReq = httpMock.expectOne((r) => r.url.includes('/api/roster/entries/entry-1'));
    const entryDto: RosterEntryDto = {
      id: 'entry-1',
      employeeId: 'emp-1',
      employeeName: 'Anea Carić',
      rosterTypeId: 'type-1',
      rosterTypeName: 'Rad',
      rosterTypeColorHex: '#336699',
      isAbsence: false,
      countsAsWork: true,
      dateFrom: '2026-08-24T00:00:00',
      dateTo: null,
      startTime: '13:00:00',
      endTime: '21:00:00',
      durationHours: 8,
      note: 'test note',
      warnings: [],
    };
    getByIdReq.flush(entryDto);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    expect(host.dialogVisible()).toBe(true);
    expect(host.editingEntry()).not.toBeNull();
    expect(host.editingEntry()?.id).toBe('entry-1');

    const dialogCmp = fixture.debugElement.query(By.directive(RosterEntryFormDialogComponent))
      .componentInstance as RosterEntryFormDialogComponent;

    expect(dialogCmp.isEditMode()).toBe(true);
    expect(dialogCmp.form.controls.rosterTypeId.value).toBe('type-1');
    expect(dialogCmp.form.controls.employeeId.value).toBe('emp-1');
    expect(dialogCmp.form.controls.startTime.value?.getHours()).toBe(13);
    expect(dialogCmp.form.controls.endTime.value?.getHours()).toBe(21);
    expect(dialogCmp.form.controls.note.value).toBe('test note');
  });

  it('reuses the dialog correctly: create-mode on an empty cell, then edit-mode on the entry cell right after', () => {
    const dayCells = fixture.debugElement.queryAll(By.css('.team-monthly__day-cell'));
    // Day 1 (index 0) has no entries in the fixture - click it first to open create mode.
    dayCells[0].nativeElement.click();
    fixture.detectChanges();

    const host = fixture.componentInstance;
    let dialogCmp = fixture.debugElement.query(By.directive(RosterEntryFormDialogComponent))
      .componentInstance as RosterEntryFormDialogComponent;
    expect(host.dialogVisible()).toBe(true);
    expect(dialogCmp.isEditMode()).toBe(false);
    expect(dialogCmp.form.controls.rosterTypeId.value).toBe('');

    // Simulate closing the create dialog (Cancel), then immediately clicking the entry cell.
    host.dialogVisible.set(false);
    fixture.detectChanges();

    const entrySpan = fixture.debugElement.query(By.css('.team-monthly__entry'));
    entrySpan.nativeElement.click();
    fixture.detectChanges();

    const getByIdReq = httpMock.expectOne((r) => r.url.includes('/api/roster/entries/entry-1'));
    getByIdReq.flush({
      id: 'entry-1',
      employeeId: 'emp-1',
      employeeName: 'Anea Carić',
      rosterTypeId: 'type-1',
      rosterTypeName: 'Rad',
      rosterTypeColorHex: '#336699',
      isAbsence: false,
      countsAsWork: true,
      dateFrom: '2026-08-24T00:00:00',
      dateTo: null,
      startTime: '13:00:00',
      endTime: '21:00:00',
      durationHours: 8,
      note: 'test note',
      warnings: [],
    } satisfies RosterEntryDto);
    fixture.detectChanges();

    dialogCmp = fixture.debugElement.query(By.directive(RosterEntryFormDialogComponent))
      .componentInstance as RosterEntryFormDialogComponent;
    expect(dialogCmp.isEditMode()).toBe(true);
    expect(dialogCmp.form.controls.rosterTypeId.value).toBe('type-1');
  });

  it('clicking a Planned (predicted, not-yet-saved) badge opens create mode prefilled with its time range', () => {
    const plannedSpan = fixture.debugElement.query(By.css('.team-monthly__entry--planned'));
    expect(plannedSpan).toBeTruthy();

    plannedSpan.nativeElement.click();
    fixture.detectChanges();

    const host = fixture.componentInstance;
    expect(host.dialogVisible()).toBe(true);
    expect(host.editingEntry()).toBeNull(); // no rosterEntryId - a prediction is never a saved record.

    const dialogCmp = fixture.debugElement.query(By.directive(RosterEntryFormDialogComponent))
      .componentInstance as RosterEntryFormDialogComponent;
    expect(dialogCmp.isEditMode()).toBe(false);
    expect(dialogCmp.form.controls.rosterTypeId.value).toBe(''); // never known for a template projection.
    expect(dialogCmp.form.controls.startTime.value?.getHours()).toBe(9);
    expect(dialogCmp.form.controls.endTime.value?.getHours()).toBe(17);
  });
});
