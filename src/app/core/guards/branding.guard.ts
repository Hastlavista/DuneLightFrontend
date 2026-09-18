import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { CurrentEmployeeService } from '../services/current-employee.service';

/** Mirrors the backend's organization.branding.manage requirement. */
export const brandingGuard: CanActivateFn = () => {
  const currentEmployee = inject(CurrentEmployeeService);
  const router = inject(Router);
  return currentEmployee.ensureLoaded().pipe(
    map(() => currentEmployee.hasGrant('organization.branding.manage') || router.createUrlTree(['/app'])),
  );
};
