import { Routes } from '@angular/router';

export const TRAINER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'my-week' },
  {
    path: 'my-week',
    loadComponent: () => import('./pages/my-week/my-week.component').then((m) => m.MyWeekComponent),
    data: { titleKey: 'NAV.TRAINER.MY_WEEK' },
  },
  {
    path: 'quick-entry',
    loadComponent: () => import('./pages/quick-entry/quick-entry.component').then((m) => m.QuickEntryComponent),
    data: { titleKey: 'NAV.TRAINER.QUICK_ENTRY' },
  },
  {
    path: 'my-clients',
    loadComponent: () => import('./pages/my-clients/my-clients.component').then((m) => m.MyClientsComponent),
    data: { titleKey: 'NAV.TRAINER.MY_CLIENTS' },
  },
  {
    path: 'my-groups',
    loadComponent: () => import('./pages/my-groups/my-groups.component').then((m) => m.MyGroupsComponent),
    data: { titleKey: 'NAV.TRAINER.MY_GROUPS' },
  },
  {
    path: 'today',
    loadComponent: () => import('./pages/today/today.component').then((m) => m.TodayComponent),
    data: { titleKey: 'NAV.TRAINER.TODAY_ALL' },
  },
  {
    path: 'my-shifts',
    loadComponent: () => import('./pages/my-shifts/my-shifts.component').then((m) => m.MyShiftsComponent),
    data: { titleKey: 'NAV.TRAINER.MY_SHIFTS' },
  },
];
