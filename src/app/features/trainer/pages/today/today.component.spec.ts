import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { TodayComponent } from './today.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

const EMPTY_PAGE = { items: [], totalCount: 0, page: 1, pageSize: 200 };

describe('TodayComponent - grant check timing on a hard refresh', () => {
  // CompanyContextService persists the selected company in localStorage; another spec's
  // selection leaking in here adds an unrelated /appointments/services request.
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('does not permanently skip the service filter fetch just because /employees/me had not resolved yet at construction', async () => {
    // This route is deliberately unguarded (no grantGuard) - a hard refresh straight into it
    // constructs the component before CurrentEmployeeService.loaded() flips true. Template
    // stubbed to an empty shell: only the constructor/effect logic under test needs to run,
    // not the full schedule-grid/dialog dependency graph.
    TestBed.overrideComponent(TodayComponent, { set: { template: '' } });
    await TestBed.configureTestingModule({
      imports: [TodayComponent],
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
    // Not resolved yet: CurrentEmployeeService.loaded() is false when the component constructs.
    const fixture = TestBed.createComponent(TodayComponent);
    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.includes('/api/employees/directory')).flush([]);
    // The required-field lookup fires unconditionally (its own supporting-read concern).
    httpMock.match((req) => req.url.includes('/api/catalog/services')).forEach((r) => r.flush(EMPTY_PAGE));
    // No optional-filter fetch yet - hasGrant() correctly reports false while unloaded.
    httpMock.expectNone((req) => req.url.includes('/api/catalog/companies'));
    expect(fixture.componentInstance.activeServices()).toEqual([]);

    // /me now resolves with the grant.
    const me: CurrentEmployee = {
      hasProfile: true,
      employeeId: 'me-1', firstName: 'Ana', lastName: 'Test', role: 'Member',
      grants: ['catalog.services.view'], colorHex: null, companies: [], hasPinSet: false,
    };
    TestBed.inject(CurrentEmployeeService).load().subscribe();
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(me);
    TestBed.tick();

    // The effect reacted to the grant becoming known and fetched the optional filter -
    // it was not permanently skipped by the one-time constructor-time check this replaced.
    const filterReq = httpMock.expectOne((req) => req.url.includes('/api/catalog/services'));
    filterReq.flush({ ...EMPTY_PAGE, items: [{ id: 's-1' }] });
    TestBed.tick();

    expect(fixture.componentInstance.activeServices().length).toBe(1);
  });
});
