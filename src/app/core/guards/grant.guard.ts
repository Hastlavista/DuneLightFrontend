import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { CurrentEmployeeService } from '../services/current-employee.service';

/**
 * Per-page grant gate for a child route under /app. Without this, a user
 * could navigate by direct URL into any page regardless of whether they hold
 * ITS grant - nav-items.ts's requiredGrants only hides the sidebar link,
 * which never blocked navigation. Same OR semantics as
 * CurrentEmployeeService.hasAnyGrant() / the backend's [RequireGrant] - pass
 * the same `requiredGrants` array already defined for that item in
 * nav-items.ts. Assumes authGuard already ran.
 */
export function grantGuard(keys: readonly string[]): CanActivateFn {
  return () => {
    const currentEmployeeService = inject(CurrentEmployeeService);
    const router = inject(Router);

    return currentEmployeeService
      .ensureLoaded()
      .pipe(map(() => currentEmployeeService.hasAnyGrant(keys) || router.createUrlTree(['/app'])));
  };
}
