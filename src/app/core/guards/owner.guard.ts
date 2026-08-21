import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { CurrentEmployeeService } from '../services/current-employee.service';

/**
 * Only the organization's Owner may enter /admin/permissions/** - mirrors the
 * backend's [RequireOwner] on GrantGroupsController/RolesController/
 * GrantsController. Assumes authGuard/adminGuard already ran.
 *
 * Explicitly awaits CurrentEmployeeService.ensureLoaded() rather than reading
 * isOwner() directly - see adminGuard's doc comment for why (router guards
 * for the whole matched route tree resolve before any component, including
 * ShellComponent which would otherwise trigger the /me fetch, instantiates).
 */
export const ownerGuard: CanActivateFn = () => {
  const currentEmployeeService = inject(CurrentEmployeeService);
  const router = inject(Router);

  return currentEmployeeService
    .ensureLoaded()
    .pipe(map(() => currentEmployeeService.isOwner() || router.createUrlTree(['/admin'])));
};
