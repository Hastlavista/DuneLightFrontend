import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { CurrentEmployeeService } from '../services/current-employee.service';

/** Mirrors the backend's organization.branding.manage requirement - sourced
 * from PAGE_POLICIES.branding (see page-policies.ts) via canPage(), same
 * catalog grantGuard/nav-items.ts use, instead of a raw grant string of its
 * own. Kept as a separate guard (rather than grantGuard('branding')) purely
 * to preserve its own redirect-to-'/app' target - unlike grantGuard's
 * redirect-to-'/app/my-week', unchanged from before this pass. */
export const brandingGuard: CanActivateFn = () => {
  const currentEmployee = inject(CurrentEmployeeService);
  const router = inject(Router);
  return currentEmployee.ensureLoaded().pipe(
    map(() => currentEmployee.canPage('branding') || router.createUrlTree(['/app'])),
  );
};
