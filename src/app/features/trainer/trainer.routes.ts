import { Routes } from '@angular/router';

export const TRAINER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'my-week' },
  {
    path: 'my-week',
    loadComponent: () => import('./pages/my-week/my-week.component').then((m) => m.MyWeekComponent),
    data: { titleKey: 'NAV.TRAINER.MY_WEEK' },
  },
  {
    path: 'today',
    loadComponent: () => import('./pages/today/today.component').then((m) => m.TodayComponent),
    data: { titleKey: 'NAV.TRAINER.TODAY_ALL' },
  },
  {
    path: 'my-clients',
    loadComponent: () => import('./pages/my-clients/my-clients.component').then((m) => m.MyClientsComponent),
    data: { titleKey: 'NAV.TRAINER.MY_CLIENTS' },
  },
  {
    // Same convention as admin's clients/:id - the shared ClientFormComponent
    // (see admin.routes.ts) is reused as-is, `:id` is either a real id (edit)
    // or the literal 'new' (create).
    path: 'my-clients/:id',
    loadComponent: () =>
      import('../admin/pages/clients/client-form/client-form.component').then((m) => m.ClientFormComponent),
    data: { titleKey: 'NAV.TRAINER.MY_CLIENTS' },
  },
  {
    path: 'my-groups',
    loadComponent: () => import('./pages/my-groups/my-groups.component').then((m) => m.MyGroupsComponent),
    data: { titleKey: 'NAV.TRAINER.MY_GROUPS' },
  },
  {
    path: 'my-groups/:id',
    loadComponent: () =>
      import('./pages/my-groups/group-detail/trainer-group-detail.component').then(
        (m) => m.TrainerGroupDetailComponent,
      ),
    data: { titleKey: 'NAV.TRAINER.MY_GROUPS' },
  },
  {
    path: 'my-shifts',
    loadComponent: () => import('./pages/my-shifts/my-shifts.component').then((m) => m.MyShiftsComponent),
    data: { titleKey: 'NAV.TRAINER.MY_SHIFTS' },
  },
  {
    path: 'profile',
    loadComponent: () => import('../profile/profile.component').then((m) => m.ProfileComponent),
    data: { titleKey: 'NAV.TRAINER.MY_PROFILE' },
  },
];
