import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { grantGuard } from './grant.guard';
import { CurrentEmployeeService } from '../services/current-employee.service';

/** Covers the P0 onboarding-deadlock fix (see current-employee.service.spec.ts): a freshly registered
 * founder has HasProfile=false but real grants (their Admin starter GrantGroup, see AuthService.Register
 * on the backend). grantGuard must let them into Company/EngagementType setup using those grants alone -
 * no Owner/founder special-casing, no legacy UserRole check. */
function stubCurrentEmployeeService(grants: string[]): CurrentEmployeeService {
  return {
    ensureLoaded: () => of(null),
    hasGrant: (key: string) => grants.includes(key),
    hasAnyGrant: (keys: readonly string[]) => keys.some((k) => grants.includes(k)),
    canPage: (page: string) => {
      const policies: Record<string, string[]> = {
        companies: ['catalog.companies.view', 'catalog.companies.manage', 'catalog.rooms.view', 'catalog.rooms.manage'],
        employees: ['employees.view', 'employees.manage'],
      };
      return (policies[page] ?? []).some((g) => grants.includes(g));
    },
  } as unknown as CurrentEmployeeService;
}

async function runGuard(page: 'companies' | 'employees', grants: string[]): Promise<boolean | UrlTree> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CurrentEmployeeService, useValue: stubCurrentEmployeeService(grants) }],
  });
  const result = TestBed.runInInjectionContext(() => grantGuard(page)({} as never, {} as never));
  return firstValueFrom(result as Observable<boolean | UrlTree>);
}

describe('grantGuard - founder bootstrap (HasProfile=false, real grants)', () => {
  it('allows the Companies route for a profile-less founder holding catalog.companies.manage', async () => {
    expect(await runGuard('companies', ['catalog.companies.manage'])).toBe(true);
  });

  it('allows the Employees route (hosts Engagement Types) for a profile-less founder holding employees.manage', async () => {
    expect(await runGuard('employees', ['employees.manage'])).toBe(true);
  });

  it('still redirects a profile-less user with no relevant grant - not an onboarding bypass', async () => {
    const result = await runGuard('companies', ['roster.entries.view']);
    expect(result).not.toBe(true);
    expect(result instanceof UrlTree).toBe(true);
  });
});
