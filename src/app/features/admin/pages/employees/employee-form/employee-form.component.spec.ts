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
    employeeId: 'me-1',
    firstName: 'Ana',
    lastName: 'Vlasnik',
    role: 'Admin',
    isOwner: false,
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
 * employee GET itself. Deliberately keeps `employee.isOwner` false in the
 * validation tests (8-10) and the legacy-wording test (6) - GrantGroup/Role
 * definition is Owner-only (see GrantGroupsController), so a non-Owner viewer
 * never fires those list/assignment requests at all (see the matching skip in
 * the component's constructor/applyEmployee), keeping this fixture honest
 * about what a real employees.role.manage-only viewer actually sees. */
async function createFixture(id: string, employee: CurrentEmployee): Promise<{ fixture: ComponentFixture<EmployeeFormComponent>; httpMock: HttpTestingController }> {
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

  httpMock.expectOne((req) => req.url.includes('/api/catalog/companies')).flush({ items: [COMPANY], totalCount: 1, page: 1, pageSize: 200 });
  httpMock.expectOne((req) => req.url.includes('/api/catalog/services')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
  httpMock.expectOne((req) => req.url.includes('/api/employees/engagement-types')).flush({ items: [ENGAGEMENT_TYPE], totalCount: 1, page: 1, pageSize: 200 });

  if (id !== 'new') {
    httpMock.expectOne((req) => req.url.endsWith(`/api/employees/${id}`) && req.method === 'GET').flush(MEMBER_EMPLOYEE);
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
    // A non-Owner holding employees.role.manage - the exact real-world viewer
    // of this field (see canManageEmployeeRole's own doc: gated by that
    // action-policy grant, not isOwner()).
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

  it('the legacy account-role field is labelled and hinted distinctly from the permission-role (GrantGroup) section', async () => {
    const { fixture } = await createFixture('employee-1', currentEmployee({ grants: ['employees.role.manage'] }));
    const text = fixture.nativeElement.textContent as string;

    // Two different section headings for two different concepts - never
    // collapsed into one "uloga" section (see FAZA 1 Part P/Q's role split).
    expect(text).toContain('Računska uloga (legacy)');
    expect(text).toContain('Dozvole');
    // Explicit hint spelling out that the legacy role and the permission role are not the same thing.
    expect(text).toContain('nije isto što i uloga dozvola');
    // A non-Owner (even one who can change the legacy role) never sees the
    // GrantGroup picker itself - that stays Owner-only end to end.
    expect(text).toContain('isključivo vlasnik organizacije');
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
