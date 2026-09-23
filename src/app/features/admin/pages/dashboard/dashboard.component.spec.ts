import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../../../../core/models/employee.model';
import { OperationalDashboardDto } from '../../../../core/models/dashboard.model';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { DashboardComponent } from './dashboard.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

const EMPTY_DASHBOARD: OperationalDashboardDto = {
  company: { id: 'c-1', name: 'Prva', isActive: true },
  date: '2026-01-01',
  schedule: [],
  staff: [],
  financial: { todayRevenue: 0, outstandingAmount: 0, unpaidBookingCount: 0, openCheckoutCount: 0, openCheckoutOutstandingAmount: 0 },
  alerts: { waitingCount: 0, noShowCount: 0, cancelledBookingCount: 0, cancelledAppointmentCount: 0, unpaidBookingCount: 0, outOfStockCount: 0, outOfStockProducts: [] },
};

const ME: CurrentEmployee = {
  hasProfile: true,
  employeeId: 'me-1', firstName: 'Ana', lastName: 'Test', role: 'Member', grants: ['catalog.companies.view'],
  colorHex: null, companies: [], hasPinSet: false,
};

/** Flushes every currently-pending dashboard request (a plain field write plus an effect's
 * own reload() can both fire around the same tick, so there may be more than one) and returns
 * the companyId the LAST one was made with - the one that reflects the settled state. */
async function settleDashboardRequests(httpMock: HttpTestingController, fixture: ComponentFixture<DashboardComponent>): Promise<string | null> {
  await Promise.resolve();
  fixture.detectChanges();
  const pending = httpMock.match((req) => req.url.includes('/api/dashboard/operational'));
  let lastCompanyId: string | null = null;
  for (const req of pending) {
    lastCompanyId = req.request.params.get('companyId');
    req.flush(EMPTY_DASHBOARD);
  }
  fixture.detectChanges();
  return lastCompanyId;
}

async function setUp(): Promise<{ fixture: ComponentFixture<DashboardComponent>; httpMock: HttpTestingController; companyContext: CompanyContextService }> {
  await TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      MessageService,
    ],
  }).compileComponents();
  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(CurrentEmployeeService).load().subscribe();
  httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(ME);

  const fixture = TestBed.createComponent(DashboardComponent);
  const companyContext = TestBed.inject(CompanyContextService);
  fixture.detectChanges();

  httpMock.expectOne((req) => req.url.includes('/api/catalog/companies')).flush({
    items: [
      { id: 'c-1', name: 'Prva', address: null, phone: null, colorHex: null, country: 'HR', isActive: true, note: null, sortOrder: 0, createdAt: '', createdBy: '', updatedAt: null, updatedBy: null },
      { id: 'c-2', name: 'Druga', address: null, phone: null, colorHex: null, country: 'HR', isActive: true, note: null, sortOrder: 1, createdAt: '', createdBy: '', updatedAt: null, updatedBy: null },
    ],
    totalCount: 2, page: 1, pageSize: 200,
  });
  await settleDashboardRequests(httpMock, fixture);
  return { fixture, httpMock, companyContext };
}

describe('DashboardComponent - "All companies" from the topbar switcher', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('specific company -> All -> another company each settle on exactly the right dashboard', async () => {
    const { fixture, httpMock, companyContext } = await setUp();

    companyContext.selectCompany('c-2');
    expect(await settleDashboardRequests(httpMock, fixture)).toBe('c-2');

    // "All companies": dashboard has no aggregate view, so it falls back to the first company
    // instead of leaving the previous company's dashboard on screen.
    companyContext.selectCompany(null);
    expect(await settleDashboardRequests(httpMock, fixture)).toBe('c-1');

    companyContext.selectCompany('c-2');
    expect(await settleDashboardRequests(httpMock, fixture)).toBe('c-2');
  });
});
