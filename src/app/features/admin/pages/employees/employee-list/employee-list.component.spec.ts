import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../../../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { EmployeeListComponent } from './employee-list.component';

/** jsdom has no ResizeObserver - PrimeNG components read it regardless of
 * which widgets are actually rendered (see employee-form.component.spec.ts
 * for the identical rationale). */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const TRANSLATIONS = {
  EMPLOYEES: {
    EMPTY: 'Nema pronađenih zaposlenika.',
    NO_LIST_PERMISSION: 'Nemate dozvolu za pregled popisa zaposlenika.',
    NEW: 'Novi zaposlenik',
    FILTER_COMPANY_ALL: 'Sve poslovnice',
    FILTER_ENGAGEMENT_TYPE_ALL: 'Sve vrste zaposlenja',
  },
};

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of(TRANSLATIONS);
  }
}

function currentEmployee(overrides: Partial<CurrentEmployee> = {}): CurrentEmployee {
  return {
    employeeId: 'me-1',
    firstName: 'Marko',
    lastName: 'Testni',
    role: 'Member',
    grants: [],
    colorHex: null,
    companies: [],
    hasPinSet: false,
    ...overrides,
  };
}

async function createFixture(employee: CurrentEmployee): Promise<{ fixture: ComponentFixture<EmployeeListComponent>; httpMock: HttpTestingController }> {
  await TestBed.configureTestingModule({
    imports: [EmployeeListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      MessageService,
      ConfirmationService,
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(CurrentEmployeeService).load().subscribe();
  httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(employee);

  const fixture = TestBed.createComponent(EmployeeListComponent);

  if (employee.grants.includes('employees.view')) {
    httpMock.expectOne((req) => req.url.includes('/api/catalog/companies')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    httpMock.expectOne((req) => req.url.includes('/api/employees/engagement-types')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
    httpMock.expectOne((req) => req.url.includes('/api/employees') && !req.url.includes('engagement-types')).flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  }

  fixture.detectChanges();
  return { fixture, httpMock };
}

describe('EmployeeListComponent - employees.view supporting-read gap', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('a viewer holding only employees.manage never fires GET /api/employees (which needs employees.view), and sees a distinct permission message instead of "no employees found"', async () => {
    const { fixture } = await createFixture(currentEmployee({ grants: ['employees.manage'] }));

    expect(fixture.componentInstance.canViewList()).toBe(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(TRANSLATIONS.EMPLOYEES.NO_LIST_PERMISSION);
    expect(text).not.toContain(TRANSLATIONS.EMPLOYEES.EMPTY);
  });

  it('a viewer holding employees.view fetches the list normally', async () => {
    const { fixture, httpMock } = await createFixture(currentEmployee({ grants: ['employees.view'] }));

    expect(fixture.componentInstance.canViewList()).toBe(true);
    httpMock.verify();
  });
});
