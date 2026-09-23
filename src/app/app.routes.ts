import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    // One shell for every authenticated employee - no more separate
    // admin/trainer sections. Page and sidebar-item visibility comes purely
    // from grants (see nav-items.ts's requiredGrants and each route's
    // grantGuard below), not from which "area" the URL is under.
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    loadChildren: () =>
      Promise.all([import('./features/admin/admin.routes'), import('./features/trainer/trainer.routes')]).then(
        ([admin, trainer]) => [...admin.ADMIN_ROUTES, ...trainer.TRAINER_ROUTES],
      ),
  },
  { path: '**', redirectTo: 'login' },
];
