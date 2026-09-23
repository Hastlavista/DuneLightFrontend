import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../models/employee.model';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { CurrentEmployeeService } from './current-employee.service';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

const isMe = (url: string) => url.endsWith('/api/employees/me');

/** Matches the real GET /api/employees/me contract (see EmployeeMeDto/EmployeeService.GetMe on the
 * backend): authorization belongs to the User and is always populated once loaded, regardless of
 * whether an Employee profile exists yet. */
function meResponse(overrides: Partial<CurrentEmployee> = {}): CurrentEmployee {
  return {
    hasProfile: true, employeeId: 'me-1', firstName: 'Ana', lastName: 'Test', role: 'Member',
    grants: [], colorHex: null, companies: [], hasPinSet: false,
    ...overrides,
  };
}

describe('CurrentEmployeeService - /employees/me', () => {
  let httpMock: HttpTestingController;
  let service: CurrentEmployeeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Registered for real (not provideHttpClient() alone): the interceptor
        // normalizes every error into an AppError before it reaches this service,
        // so a test that skips it would never catch a 404-detection bug this
        // service has around that transformation (found via live E2E testing).
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', children: [] }]),
        provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
        MessageService,
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CurrentEmployeeService);
  });

  afterEach(() => httpMock.verify());

  it('a freshly registered founder (200, HasProfile=false) is loaded with their real grants, not treated as anonymous', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(
      meResponse({ hasProfile: false, employeeId: null, firstName: null, lastName: null, grants: ['catalog.companies.manage', 'employees.engagement-types.manage'] }),
    );

    expect(service.loaded()).toBe(true);
    expect(service.hasProfile()).toBe(false);
    // The whole point of the fix: grants are readable without an Employee profile.
    expect(service.hasGrant('catalog.companies.manage')).toBe(true);
    expect(service.hasGrant('employees.engagement-types.manage')).toBe(true);
  });

  it('any failure (there is no longer a meaningful 404 case) leaves ensureLoaded() unresolved so the next call retries', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(null, { status: 404, statusText: 'Not Found' });

    expect(service.loaded()).toBe(false);
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(meResponse());
    expect(service.loaded()).toBe(true);
    expect(service.hasProfile()).toBe(true);
  });

  it('two concurrent ensureLoaded() callers (e.g. grantGuard and ShellComponent, same navigation) share one request', () => {
    const results: (unknown | null)[] = [];
    service.ensureLoaded().subscribe((r) => results.push(r));
    service.ensureLoaded().subscribe((r) => results.push(r));

    httpMock.expectOne((req) => isMe(req.url)).flush(meResponse());

    expect(results.length).toBe(2);
    expect(results[0]).toEqual(results[1]);
  });

  it('a concurrent load() (forced refresh) also joins an already in-flight request', () => {
    service.load().subscribe();
    service.load().subscribe();

    httpMock.expectOne((req) => isMe(req.url)).flush(meResponse());
  });

  it('a later call after the in-flight request settles fires a fresh request', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(null, { status: 503, statusText: 'Unavailable' });

    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(null, { status: 503, statusText: 'Unavailable' });
  });

  it('a 5xx is NOT cached - the next ensureLoaded() retries and grants become available once it succeeds', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(null, { status: 503, statusText: 'Unavailable' });

    expect(service.loaded()).toBe(false);
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(meResponse({ grants: ['employees.view'] }));
    expect(service.hasGrant('employees.view')).toBe(true);
  });

  it('a User without an Employee profile and without a given grant does not get it - not an onboarding bypass', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(
      meResponse({ hasProfile: false, employeeId: null, firstName: null, lastName: null, grants: ['roster.entries.view'] }),
    );

    expect(service.hasProfile()).toBe(false);
    expect(service.hasGrant('catalog.companies.manage')).toBe(false);
    expect(service.hasGrant('permissions.manage')).toBe(false);
  });

  it('after profile completion, a refresh reports hasProfile=true and normal Employee fields', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(
      meResponse({ hasProfile: false, employeeId: null, firstName: null, lastName: null, grants: ['catalog.companies.manage'] }),
    );
    expect(service.hasProfile()).toBe(false);

    service.load().subscribe();
    httpMock.expectOne((req) => isMe(req.url)).flush(meResponse({ hasProfile: true, employeeId: 'emp-1', firstName: 'Ana', lastName: 'Osnivač', grants: ['catalog.companies.manage'] }));

    expect(service.hasProfile()).toBe(true);
    expect(service.employee()?.employeeId).toBe('emp-1');
    expect(service.employee()?.firstName).toBe('Ana');
  });
});
