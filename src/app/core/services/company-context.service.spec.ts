import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { CurrentEmployee } from '../models/employee.model';
import { CompanyContextService } from './company-context.service';
import { CompaniesService } from './companies.service';
import { CurrentEmployeeService } from './current-employee.service';

type Page = { items: { id: string; name: string; colorHex: string | null }[] };

function employee(id: string, grants: string[], companyIds: string[] = []): CurrentEmployee {
  return {
    hasProfile: true,
    employeeId: id, firstName: id, lastName: 'Test', role: 'Member', grants, colorHex: null, hasPinSet: false,
    companies: companyIds.map((companyId, i) => ({ companyId, companyName: companyId, isPrimary: i === 0 })),
  };
}

describe('CompanyContextService', () => {
  let requests: Subject<Page>[];
  let getPage: ReturnType<typeof vi.fn>;
  const employeeState = signal<CurrentEmployee | null>(null);
  const loadedState = signal(false);

  function page(...ids: string[]): Page {
    return { items: ids.map((id) => ({ id, name: id, colorHex: null })) };
  }

  function respond(index: number, value: Page): void {
    requests[index].next(value);
    requests[index].complete();
  }

  function fail(index: number): void {
    requests[index].error(new Error('network down'));
  }

  function signIn(value: CurrentEmployee | null): CompanyContextService {
    employeeState.set(value);
    loadedState.set(true);
    const service = TestBed.inject(CompanyContextService);
    TestBed.tick();
    return service;
  }

  beforeEach(() => {
    localStorage.clear();
    employeeState.set(null);
    loadedState.set(false);
    requests = [];
    getPage = vi.fn(() => {
      const request = new Subject<Page>();
      requests.push(request);
      return request;
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: CompaniesService, useValue: { getPage } },
        {
          provide: CurrentEmployeeService,
          useValue: {
            employee: employeeState.asReadonly(),
            loaded: loadedState.asReadonly(),
            hasGrant: (key: string) => employeeState()?.grants.includes(key) ?? false,
          },
        },
      ],
    });
  });

  it('loads once the signed-in employee is known, and never before', () => {
    const service = TestBed.inject(CompanyContextService);
    TestBed.tick();
    service.loadCompanies();
    expect(getPage).not.toHaveBeenCalled();

    employeeState.set(employee('admin', ['catalog.companies.view']));
    loadedState.set(true);
    TestBed.tick();
    expect(getPage).toHaveBeenCalledTimes(1);
  });

  it('a page loading before the identity effect first runs does not cause a second request', () => {
    employeeState.set(employee('admin', ['catalog.companies.view']));
    loadedState.set(true);
    const service = TestBed.inject(CompanyContextService);

    service.loadCompanies();
    TestBed.tick();

    expect(getPage).toHaveBeenCalledTimes(1);
  });

  it('fires only one companies request when loadCompanies is called again while in flight', () => {
    const service = signIn(employee('admin', ['catalog.companies.view']));

    service.loadCompanies();
    service.loadCompanies();

    expect(getPage).toHaveBeenCalledTimes(1);
  });

  it('refreshCompanies() during an in-flight load queues exactly one reload, so a company write is never lost', () => {
    const service = signIn(employee('admin', ['catalog.companies.view']));

    service.refreshCompanies();
    service.refreshCompanies();
    expect(getPage).toHaveBeenCalledTimes(1);

    respond(0, page('stale'));
    expect(getPage).toHaveBeenCalledTimes(2);
    respond(1, page('fresh'));
    expect(service.companies().map((c) => c.id)).toEqual(['fresh']);
  });

  it('allows a new request once the previous one has completed', () => {
    const service = signIn(employee('admin', ['catalog.companies.view']));
    respond(0, page('c1'));

    service.loadCompanies();

    expect(getPage).toHaveBeenCalledTimes(2);
  });

  it('without catalog.companies.view uses the assigned companies and never calls the catalog endpoint', () => {
    const service = signIn(employee('trainer', ['roster.entries.view'], ['c-1', 'c-2']));

    expect(getPage).not.toHaveBeenCalled();
    expect(service.companies().map((c) => c.id)).toEqual(['c-1', 'c-2']);
    expect(service.selectedCompanyId()).toBe('c-1');
  });

  it('a PIN switch to another user reloads for that user and drops the previous user\'s pending response', () => {
    const service = signIn(employee('admin', ['catalog.companies.view']));
    expect(getPage).toHaveBeenCalledTimes(1);

    employeeState.set(employee('trainer', ['roster.entries.view'], ['c-9']));
    TestBed.tick();
    respond(0, page('admin-only-1', 'admin-only-2'));

    expect(service.companies().map((c) => c.id)).toEqual(['c-9']);
  });

  it('a failed refresh keeps the current selection (list falls back, selection is untouched)', () => {
    const service = signIn(employee('admin', ['catalog.companies.view']));
    respond(0, page('c-1', 'c-2'));
    service.selectCompany('c-2');

    service.refreshCompanies();
    fail(1);

    expect(service.selectedCompanyId()).toBe('c-2');
    expect(localStorage.getItem('dl_selected_company')).toBe('c-2');
  });

  it('a later successful refresh still clears a selection that turns out to be genuinely gone', () => {
    const service = signIn(employee('admin', ['catalog.companies.view']));
    respond(0, page('c-1', 'c-2'));
    service.selectCompany('c-2');

    service.refreshCompanies();
    fail(1);
    expect(service.selectedCompanyId()).toBe('c-2');

    service.refreshCompanies();
    respond(2, page('c-1'));
    expect(service.selectedCompanyId()).toBeNull();
  });

  it('clears the list on logout', () => {
    const service = signIn(employee('trainer', ['roster.entries.view'], ['c-1']));
    expect(service.companies().length).toBe(1);

    loadedState.set(false);
    employeeState.set(null);
    TestBed.tick();

    expect(service.companies()).toEqual([]);
  });
});
