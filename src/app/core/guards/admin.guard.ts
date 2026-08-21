import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { CurrentEmployeeService } from '../services/current-employee.service';
import { ADMIN_AREA_GRANTS } from './admin-area-grants';

/**
 * Lets the Owner in unconditionally, or anyone holding at least one grant
 * that opens a screen under /admin (see ADMIN_AREA_GRANTS) - same OR
 * semantics as the backend's [RequireGrant]. Replaces the old legacy-role
 * check (`currentRole() === 'Admin'`): since the grant-system migration,
 * every with-login-created employee is hardcoded to UserRole.Member
 * server-side (see EmployeeService.CreateWithLogin), so that check would
 * lock every employee except the Owner out of /admin regardless of their
 * actual grants. Assumes authGuard already ran.
 *
 * Explicitly awaits CurrentEmployeeService.ensureLoaded() rather than reading
 * its signals directly - router guards for the whole matched route tree
 * resolve BEFORE any component instantiates, so on a hard refresh/direct URL
 * entry into /admin/** ShellComponent (which would otherwise kick off the
 * /me fetch) hasn't run yet. Waiting here, instead of trusting a synchronous
 * fallback, is what makes this correct rather than just "usually fine".
 */
export const adminGuard: CanActivateFn = () => {
  const currentEmployeeService = inject(CurrentEmployeeService);
  const router = inject(Router);

  return currentEmployeeService
    .ensureLoaded()
    .pipe(map(() => currentEmployeeService.hasAnyGrant(ADMIN_AREA_GRANTS) || router.createUrlTree(['/app'])));
};
