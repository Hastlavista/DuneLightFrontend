import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { CurrentEmployeeService } from '../services/current-employee.service';

/**
 * Only the organization's Owner may enter /app/permissions/** - mirrors the
 * backend's [RequireOwner] on GrantGroupsController/RolesController/
 * GrantsController. Assumes authGuard already ran.
 *
 * Explicitly awaits CurrentEmployeeService.ensureLoaded() rather than reading
 * isOwner() directly - router guards for the whole matched route tree
 * resolve before any component, including ShellComponent which would
 * otherwise trigger the /me fetch, instantiates.
 *
 * Resolves through canPage('permissions') - PAGE_POLICIES.permissions is
 * `{ ownerOnly: true }` (see page-policies.ts) - rather than isOwner()
 * directly, so Owner bypass stays decided in exactly one place
 * (evaluatePermissionPolicy). Kept as its own guard (rather than
 * grantGuard('permissions')) purely to preserve its own redirect-to-'/app'
 * target, unchanged from before this pass.
 */
export const ownerGuard: CanActivateFn = () => {
  const currentEmployeeService = inject(CurrentEmployeeService);
  const router = inject(Router);

  return currentEmployeeService
    .ensureLoaded()
    .pipe(map(() => currentEmployeeService.canPage('permissions') || router.createUrlTree(['/app'])));
};
