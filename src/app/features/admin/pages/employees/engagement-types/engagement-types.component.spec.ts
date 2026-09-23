import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../../../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { EngagementTypesComponent } from './engagement-types.component';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const TRANSLATIONS = {
  EMPLOYEES: {
    ENGAGEMENT_TYPES: {
      EMPTY: 'Nema pronađenih vrsta zaposlenja.',
      NO_LIST_PERMISSION: 'Nemate dozvolu za pregled vrsta zaposlenja.',
      NEW: 'Nova vrsta zaposlenja',
    },
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

async function createFixture(employee: CurrentEmployee): Promise<{ fixture: ComponentFixture<EngagementTypesComponent>; httpMock: HttpTestingController }> {
  await TestBed.configureTestingModule({
    imports: [EngagementTypesComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      MessageService,
      ConfirmationService,
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(CurrentEmployeeService).load().subscribe();
  httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(employee);

  const fixture = TestBed.createComponent(EngagementTypesComponent);

  if (employee.grants.includes('employees.engagement-types.view')) {
    httpMock.expectOne((req) => req.url.includes('/api/employees/engagement-types')).flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  }

  fixture.detectChanges();
  return { fixture, httpMock };
}

describe('EngagementTypesComponent - employees.engagement-types.view supporting-read gap', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mounted eagerly alongside the Zaposlenici tab (see EmployeesComponent), a viewer lacking employees.engagement-types.view never fires GET /api/employees/engagement-types and sees a distinct permission message', async () => {
    const { fixture } = await createFixture(currentEmployee({ grants: ['employees.manage'] }));

    expect(fixture.componentInstance.canViewList()).toBe(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(TRANSLATIONS.EMPLOYEES.ENGAGEMENT_TYPES.NO_LIST_PERMISSION);
    expect(text).not.toContain(TRANSLATIONS.EMPLOYEES.ENGAGEMENT_TYPES.EMPTY);
  });

  it('a viewer holding employees.engagement-types.view fetches the list normally', async () => {
    const { fixture, httpMock } = await createFixture(currentEmployee({ grants: ['employees.engagement-types.view'] }));

    expect(fixture.componentInstance.canViewList()).toBe(true);
    httpMock.verify();
  });
});
