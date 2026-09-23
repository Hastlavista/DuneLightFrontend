import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CompanyDto } from '../../../../../core/models/company.model';
import { CurrentEmployee, EmployeeDto } from '../../../../../core/models/employee.model';
import { EngagementTypeDto } from '../../../../../core/models/engagement-type.model';
import { NotificationService } from '../../../../../core/services/notification.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { EmployeeFormComponent } from './employee-form.component';

/** jsdom has no ResizeObserver - PrimeNG's p-tabs (TabList) reads it in
 * ngAfterViewInit regardless of which tab is active, so every test needs this
 * stub even though none of these tests touch tab-resize behavior itself. */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

/** Satisfies onSave()'s post-save navigateBack()/router.navigate() calls -
 * with no routes at all, RouterModule logs an unhandled NG04002 rejection
 * after the test has already finished asserting, which is just test-harness
 * noise, not a real navigation this suite cares about. */
@Component({ template: '' })
class EmptyRouteComponent {}

/** Only the keys these tests actually read. `ROLES.MEMBER` here is the fixed
 * wording ("Član (legacy)") - see hr.json:146 - distinct on purpose from any
 * real GrantGroup name (e.g. "Trener") to stop the legacy account role and a
 * capability-managed permission role from reading as the same concept. */
const TRANSLATIONS = {
  ROLES: { ADMIN: 'Administrator (legacy)', MEMBER: 'Član (legacy)', RECEPTION: 'Recepcija (legacy)' },
  EMPLOYEES: {
    SECTION_ROLE_ASSIGNMENT: 'Računska uloga (legacy)',
    FIELD_ROLE: 'Računska uloga (legacy)',
    LEGACY_ROLE_HINT: 'Računska uloga je naslijeđena postavka računa i nije isto što i uloga dozvola.',
    SECTION_PERMISSIONS: 'Dozvole',
    PERMISSIONS_OWNER_ONLY: 'Dodjelu grant grupa i poslovnih oznaka upravlja isključivo vlasnik organizacije.',
    INVALID_FORM_HINT: 'Provjerite označena obavezna polja prije spremanja.',
    SAVE_HINT: 'Za spremanje trebaju biti popunjena obavezna polja.',
    CREATED: 'Zaposlenik je stvoren.',
  },
  COMMON: { SUCCESS_TITLE: 'Uspjeh', ERROR_TITLE: 'Greška' },
};

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of(TRANSLATIONS);
  }
}

function currentEmployee(overrides: Partial<CurrentEmployee> = {}): CurrentEmployee {
  return {
    hasProfile: true,
    employeeId: 'me-1',
    firstName: 'Ana',
    lastName: 'Testna',
    // Legacy account role only - nothing here may depend on it; access comes from grants.
    role: 'Member',
    grants: [],
    colorHex: null,
    companies: [],
    hasPinSet: false,
    ...overrides,
  };
}

const COMPANY: CompanyDto = {
  id: 'company-1', name: 'Centar', address: null, phone: null, colorHex: null, country: 'HR',
  isActive: true, note: null, sortOrder: 0, createdAt: '', createdBy: '', updatedAt: null, updatedBy: null,
};

const ENGAGEMENT_TYPE: EngagementTypeDto = {
  id: 'engagement-1', name: 'Puno radno vrijeme', isActive: true, sortOrder: 0,
  createdAt: '', createdBy: null, updatedAt: null, updatedBy: null,
};

const MEMBER_EMPLOYEE: EmployeeDto = {
  id: 'employee-1', firstName: 'Marko', lastName: 'Trener', phone: null, email: 'marko@dunelight.local',
  dateOfBirth: null, address: null, oib: null, note: null, compensationNote: null, colorHex: null, sortOrder: 0,
  employmentStartDate: '2026-01-01T00:00:00Z', employmentEndDate: null,
  engagementTypeId: 'engagement-1', engagementTypeName: 'Puno radno vrijeme',
  isActive: true, userId: 'user-marko', role: 'Member', grantGroupNames: ['Trener'], roleNames: [],
  companies: [{ companyId: 'company-1', companyName: 'Centar', isPrimary: true }], services: [],
  createdAt: '', createdBy: null, updatedAt: null, updatedBy: null, warning: null,
};

function routeStub(id: string) {
  return { snapshot: { paramMap: convertToParamMap({ id }), queryParamMap: convertToParamMap({}) } };
}

/** Flushes the lookups every mode fires (companies/services/engagement-types),
 * plus /api/employees/me for CurrentEmployeeService and, in edit mode, the
 * employee GET itself. Residual IsOwner Removal - there is no Owner concept
 * left to keep honest here; GrantGroup/Role list and assignment requests are
 * each gated behind their own real grant (permissions.view/manage for
 * GrantGroups, employees.view/manage for Roles - see canViewGrantGroups/
 * canViewRoles's own doc on the component), so this fixture only expects the
 * ones the given employee's grants actually unlock.
 *
 * The three catalog lookup calls are each gated behind their own .view grant
 * (see loadActiveCompanies/loadActiveServices/loadActiveEngagementTypes) -
 * this fixture only expects the ones the given employee's grants actually unlock,
 * mirroring what the component itself will (or won't) fire. */
async function createFixture(id: string, employee: CurrentEmployee, options: { failRoleAssignments?: boolean; failGrantGroupAssignments?: boolean } = {}): Promise<{ fixture: ComponentFixture<EmployeeFormComponent>; httpMock: HttpTestingController }> {
  await TestBed.configureTestingModule({
    imports: [EmployeeFormComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: '**', component: EmptyRouteComponent }]),
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      MessageService,
      { provide: ActivatedRoute, useValue: routeStub(id) },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(CurrentEmployeeService).load().subscribe();
  httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(employee);

  const fixture = TestBed.createComponent(EmployeeFormComponent);

  const grants = new Set(employee.grants);
  if (grants.has('catalog.companies.view')) {
    httpMock.expectOne((req) => req.url.includes('/api/catalog/companies')).flush({ items: [COMPANY], totalCount: 1, page: 1, pageSize: 200 });
  }
  if (grants.has('catalog.services.view')) {
    httpMock.expectOne((req) => req.url.includes('/api/catalog/services')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
  }
  if (grants.has('employees.engagement-types.view')) {
    httpMock.expectOne((req) => req.url.includes('/api/employees/engagement-types')).flush({ items: [ENGAGEMENT_TYPE], totalCount: 1, page: 1, pageSize: 200 });
  }

  // Grant-only Tenant Authorization Refactor - GrantGroups (permissions.view/
  // manage) and Roles (employees.view/manage) catalog lookups are each gated
  // behind their own grant now, independently of Owner status (see
  // canViewGrantGroups/canViewRoles's own doc on the component).
  const canViewGrantGroups = grants.has('permissions.view') || grants.has('permissions.manage');
  const canViewRoles = grants.has('employees.view') || grants.has('employees.manage');
  if (canViewGrantGroups) {
    httpMock
      .expectOne((req) => req.url.endsWith('/api/permissions/grant-groups') && req.method === 'GET')
      .flush([{ id: 'grant-group-1', name: 'Trener', grants: [], assignedUserCount: 1, createdAt: null, updatedAt: null }]);
  }
  if (canViewRoles) {
    httpMock
      .expectOne((req) => req.url.endsWith('/api/permissions/roles') && req.method === 'GET')
      .flush([{ id: 'role-1', name: 'Trener', createdAt: null }]);
  }

  if (id !== 'new') {
    httpMock.expectOne((req) => req.url.endsWith(`/api/employees/${id}`) && req.method === 'GET').flush(MEMBER_EMPLOYEE);
    if (canViewGrantGroups) {
      const grantGroupAssignments = httpMock.expectOne((req) => req.url.endsWith(`/api/permissions/grant-groups/assignments/${MEMBER_EMPLOYEE.userId}`));
      if (options.failGrantGroupAssignments) {
        grantGroupAssignments.flush(null, { status: 500, statusText: 'Server Error' });
      } else {
        grantGroupAssignments.flush(['grant-group-1']);
      }
    }
    if (canViewRoles) {
      const roleAssignments = httpMock.expectOne((req) => req.url.endsWith(`/api/permissions/roles/assignments/${MEMBER_EMPLOYEE.userId}`));
      if (options.failRoleAssignments) {
        roleAssignments.flush(null, { status: 500, statusText: 'Server Error' });
      } else {
        roleAssignments.flush([]);
      }
    }
  }

  fixture.detectChanges();
  return { fixture, httpMock };
}

function fillRequiredFields(component: EmployeeFormComponent, skip: { engagementType?: boolean; primaryCompany?: boolean } = {}): void {
  component.form.controls.firstName.setValue('Ivana');
  component.form.controls.lastName.setValue('Testna');
  component.form.controls.email.setValue('ivana.testna@dunelight.local');
  component.form.controls.employmentStartDate.setValue(new Date(2026, 8, 21));
  component.form.controls.password.setValue('password123');
  component.toggleCompany(COMPANY.id);
  if (!skip.primaryCompany) {
    component.selectPrimaryCompany(COMPANY.id);
  }
  if (!skip.engagementType) {
    component.selectEngagementType(ENGAGEMENT_TYPE.id);
  }
}

describe('EmployeeFormComponent - legacy UserRole wording', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('UserRole.Member displays as "Član (legacy)", not the GrantGroup name "Trener"', async () => {
    // A viewer holding employees.role.manage - the exact real-world viewer of
    // this field (see canManageEmployeeRole's own doc: gated by that
    // action-policy grant).
    const { fixture } = await createFixture('employee-1', currentEmployee({ grants: ['employees.role.manage'] }));
    const component = fixture.componentInstance;

    expect(component.form.controls.userRole.value).toBe('Member');
    // The fix under test: the translation-key mapping itself, independent of
    // any particular UI widget's rendering internals.
    const memberOption = component.userRoleSelectOptions().find((option) => option.value === 'Member');
    expect(memberOption?.label).toBe('Član (legacy)');
    expect(memberOption?.label).not.toBe('Trener');

    const roleField = fixture.nativeElement.querySelector('label[for="employee-user-role"]')?.closest('.dl-form__field');
    expect(roleField).toBeTruthy();
    expect(roleField.textContent).toContain('Član (legacy)');
    expect(roleField.textContent).not.toContain('Trener');
  });

  it('the legacy account-role field is labelled and hinted distinctly from the permission-role (Dozvole) section', async () => {
    // employees.role.manage (legacy account-role) + employees.view (enough to
    // see, but not manage, the Roles half of the Dozvole section) - Grant-only
    // Tenant Authorization Refactor: these are three genuinely independent
    // grants (employees.role.manage / employees.view+.manage / permissions.*),
    // not one Owner-only bundle - see canViewRoles/canManageRoleAssignments's
    // own doc on the component.
    const { fixture } = await createFixture('employee-1', currentEmployee({ grants: ['employees.role.manage', 'employees.view'] }));
    const text = fixture.nativeElement.textContent as string;

    // Two different section headings for two different concepts - never
    // collapsed into one "uloga" section (see FAZA 1 Part P/Q's role split).
    expect(text).toContain('Računska uloga (legacy)');
    expect(text).toContain('Dozvole');
    // Explicit hint spelling out that the legacy role and the permission role are not the same thing.
    expect(text).toContain('nije isto što i uloga dozvola');
  });

  it('a viewer with employees.view but not employees.manage sees the Roles picker but cannot toggle it', async () => {
    const { fixture } = await createFixture('employee-1', currentEmployee({ grants: ['employees.view'] }));
    const rolesField = fixture.nativeElement.querySelector('label[for="employee-roles"]')?.closest('.dl-form__field');
    const roleButton = rolesField?.querySelector('button');

    expect(roleButton).toBeTruthy();
    expect(roleButton.disabled).toBe(true);
  });
});

describe('EmployeeFormComponent - invalid submit feedback', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('missing engagementTypeId: blocks submit, marks the field touched, and shows the invalid-form message', async () => {
    const { fixture, httpMock } = await createFixture('new', currentEmployee({ grants: ['employees.manage'] }));
    const component = fixture.componentInstance;

    fillRequiredFields(component, { engagementType: true });
    component.onSave();
    fixture.detectChanges();

    expect(component.form.controls.engagementTypeId.touched).toBe(true);
    expect(component.validationAttempted()).toBe(true);
    expect(fixture.nativeElement.querySelector('.employee-form-page__footer-hint').textContent).toContain(TRANSLATIONS.EMPLOYEES.INVALID_FORM_HINT);

    httpMock.expectNone((req) => req.url.endsWith('/api/employees/with-login'));
  });

  it('missing primaryCompanyId: blocks submit, marks the field touched, and shows the invalid-form message', async () => {
    const { fixture, httpMock } = await createFixture('new', currentEmployee({ grants: ['employees.manage'] }));
    const component = fixture.componentInstance;

    fillRequiredFields(component, { primaryCompany: true });
    component.onSave();
    fixture.detectChanges();

    expect(component.form.errors?.['primaryNotSelected']).toBeTruthy();
    expect(component.form.controls.primaryCompanyId.touched).toBe(true);
    expect(component.validationAttempted()).toBe(true);
    expect(fixture.nativeElement.querySelector('.employee-form-page__footer-hint').textContent).toContain(TRANSLATIONS.EMPLOYEES.INVALID_FORM_HINT);

    httpMock.expectNone((req) => req.url.endsWith('/api/employees/with-login'));
  });

  it('a fully valid form submits, and never shows the invalid-form message', async () => {
    const { fixture, httpMock } = await createFixture('new', currentEmployee({ grants: ['employees.manage'] }));
    const component = fixture.componentInstance;

    fillRequiredFields(component);
    const hintBefore = fixture.nativeElement.querySelector('.employee-form-page__footer-hint').textContent;
    expect(hintBefore).not.toContain(TRANSLATIONS.EMPLOYEES.INVALID_FORM_HINT);

    component.onSave();
    fixture.detectChanges();

    expect(component.validationAttempted()).toBe(false);
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/with-login') && req.method === 'POST')
      .flush({ employeeId: 'new-employee-1', userId: 'new-user-1', email: 'ivana.testna@dunelight.local', grantGroupIds: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.employee-form-page__footer-hint').textContent).not.toContain(TRANSLATIONS.EMPLOYEES.INVALID_FORM_HINT);
  });
});

describe('EmployeeFormComponent - supporting-read gap (employees.manage without catalog view grants)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('never fires the companies/services/engagement-types lookups when the viewer lacks their .view grants, and leaves the pickers empty rather than 403ing', async () => {
    // A custom minimal GrantGroup: employees.manage only, none of
    // catalog.companies.view / catalog.services.view / employees.engagement-types.view.
    // Before the fix, loadActiveCompanies()/loadActiveServices()/
    // loadActiveEngagementTypes() fired unconditionally and 403'd server-side
    // (suppressErrorToast swallowed the error) - httpMock.verify() below would
    // fail if any of those three requests were still sent.
    const { fixture, httpMock } = await createFixture('new', currentEmployee({ grants: ['employees.manage'] }));
    const component = fixture.componentInstance;

    expect(component.companyOptions()).toEqual([]);
    expect(component.serviceOptions()).toEqual([]);
    expect(component.engagementTypeOptions()).toEqual([]);

    httpMock.expectNone((req) => req.url.includes('/api/catalog/companies'));
    httpMock.expectNone((req) => req.url.includes('/api/catalog/services'));
    httpMock.expectNone((req) => req.url.includes('/api/employees/engagement-types'));
  });

  it('fires each lookup once its matching .view grant is present', async () => {
    const { httpMock } = await createFixture(
      'new',
      currentEmployee({
        grants: ['employees.manage', 'catalog.companies.view', 'catalog.services.view', 'employees.engagement-types.view'],
      }),
    );

    // createFixture already asserted+flushed all three via its grant-gated
    // expectOne calls; verify() confirms nothing extra/unexpected was sent.
    httpMock.verify();
  });
});

describe('EmployeeFormComponent - assignment sets that never loaded', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const grants = ['employees.view', 'employees.manage', 'catalog.companies.view', 'employees.engagement-types.view'];

  it('does not replace Role assignments with [] when loading them failed', async () => {
    const { fixture, httpMock } = await createFixture('employee-1', currentEmployee({ grants }), { failRoleAssignments: true });

    fixture.componentInstance.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/employee-1') && req.method === 'PUT').flush(MEMBER_EMPLOYEE);

    httpMock.expectNone((req) => req.url.includes('/api/permissions/roles/assignments/') && req.method === 'PUT');
  });

  it('still replaces Role assignments when they loaded normally', async () => {
    const { fixture, httpMock } = await createFixture('employee-1', currentEmployee({ grants }));

    fixture.componentInstance.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/employee-1') && req.method === 'PUT').flush(MEMBER_EMPLOYEE);

    httpMock.expectOne((req) => req.url.endsWith(`/api/permissions/roles/assignments/${MEMBER_EMPLOYEE.userId}`) && req.method === 'PUT').flush(null);
  });
});

describe('EmployeeFormComponent - GrantGroup assignments failed to load', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const grants = ['employees.manage', 'employees.view', 'permissions.view', 'permissions.assignments.manage', 'catalog.companies.view', 'employees.engagement-types.view'];

  it('explains why save is unavailable, sends nothing, and a successful retry unblocks it', async () => {
    const { fixture, httpMock } = await createFixture('employee-1', currentEmployee({ grants }), { failGrantGroupAssignments: true });
    const component = fixture.componentInstance;
    const notifications = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notifications, 'showError');

    expect(component.grantGroupAssignmentsFailed()).toBe(true);
    component.onSave();
    httpMock.expectNone((req) => req.method === 'PUT');
    expect(errorSpy).toHaveBeenCalledTimes(1);

    component.retryGrantGroupAssignments();
    httpMock.expectOne((req) => req.url.endsWith(`/api/permissions/grant-groups/assignments/${MEMBER_EMPLOYEE.userId}`)).flush(['grant-group-1']);
    expect(component.grantGroupAssignmentsFailed()).toBe(false);
    expect(component.form.controls.grantGroupIds.value).toEqual(['grant-group-1']);

    component.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/employee-1') && req.method === 'PUT').flush(MEMBER_EMPLOYEE);
    const replace = httpMock.expectOne((req) => req.url.endsWith(`/api/permissions/grant-groups/assignments/${MEMBER_EMPLOYEE.userId}`) && req.method === 'PUT');
    expect(replace.request.body).toEqual({ grantGroupIds: ['grant-group-1'] });
    replace.flush(null);
    httpMock.match((req) => req.url.includes('/api/permissions/roles/assignments/') && req.method === 'PUT').forEach((r) => r.flush(null));
  });
});
