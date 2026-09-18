import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { PageKey } from '../permissions/page-policies';
import { CurrentEmployeeService } from '../services/current-employee.service';

/**
 * Per-page policy gate for a child route under /app. Without this, a user
 * could navigate by direct URL into any page regardless of whether they hold
 * its policy - nav-items.ts's NavItem.pageKey only hides the sidebar link,
 * which never blocked navigation. Resolves `pageKey` through
 * CurrentEmployeeService.canPage() - same PAGE_POLICIES lookup
 * SidebarComponent uses for that item's visibility, so the two can never
 * drift apart. Assumes authGuard already ran.
 */
export function grantGuard(pageKey: PageKey): CanActivateFn {
  return () => {
    const currentEmployeeService = inject(CurrentEmployeeService);
    const router = inject(Router);

    return currentEmployeeService
      .ensureLoaded()
      // `/app` itself redirects to `dashboard`. Redirecting a user who lacks
      // the dashboard grant back there therefore creates an endless
      // `/app` -> `/app/dashboard` -> `/app` navigation loop, freezing the
      // browser immediately after login. `my-week` is deliberately unguarded
      // and is the safe landing page for every authenticated employee.
      .pipe(map(() => currentEmployeeService.canPage(pageKey) || router.createUrlTree(['/app', 'my-week'])));
  };
}
