import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/** Only the "Admin" role may enter /admin. Assumes authGuard already ran. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.currentRole() === 'Admin') {
    return true;
  }

  return router.createUrlTree(['/app']);
};
