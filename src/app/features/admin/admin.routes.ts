import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    data: { titleKey: 'NAV.ADMIN.DASHBOARD' },
  },
  {
    path: 'schedule',
    loadComponent: () => import('./pages/schedule/schedule.component').then((m) => m.ScheduleComponent),
    data: { titleKey: 'NAV.ADMIN.SCHEDULE' },
  },
  {
    path: 'shifts',
    loadComponent: () => import('./pages/shifts/shifts.component').then((m) => m.ShiftsComponent),
    data: { titleKey: 'NAV.ADMIN.SHIFTS' },
  },
  {
    path: 'locations',
    loadComponent: () =>
      import('./pages/catalog/locations/locations.component').then((m) => m.LocationsComponent),
    data: { titleKey: 'NAV.ADMIN.LOCATIONS' },
  },
  {
    path: 'clients',
    loadComponent: () => import('./pages/clients/clients.component').then((m) => m.ClientsComponent),
    data: { titleKey: 'NAV.ADMIN.CLIENTS' },
  },
  {
    // Same convention as 'employees/:id' - the create/edit form is a separate
    // routed page (uklj. tab s paketima klijenta), `:id` is either a real id
    // (edit) or the literal 'new' (create).
    path: 'clients/:id',
    loadComponent: () =>
      import('./pages/clients/client-form/client-form.component').then((m) => m.ClientFormComponent),
    data: { titleKey: 'NAV.ADMIN.CLIENTS' },
  },
  {
    path: 'employees',
    loadComponent: () => import('./pages/employees/employees.component').then((m) => m.EmployeesComponent),
    data: { titleKey: 'NAV.ADMIN.EMPLOYEES' },
  },
  {
    // Same convention as 'services/packages/:id' - the create/edit form is a
    // separate routed page (not a modal, the form is too large), `:id` is
    // either a real id (edit) or the literal 'new' (create).
    path: 'employees/:id',
    loadComponent: () =>
      import('./pages/employees/employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
    data: { titleKey: 'NAV.ADMIN.EMPLOYEES' },
  },
  {
    path: 'groups',
    loadComponent: () => import('./pages/groups/groups.component').then((m) => m.GroupsComponent),
    data: { titleKey: 'NAV.ADMIN.GROUPS' },
  },
  {
    // Same convention as 'employees/:id' - the create/edit/detail page is a
    // separate routed page, `:id` is either a real id (edit/detail) or the
    // literal 'new' (create).
    path: 'groups/:id',
    loadComponent: () => import('./pages/groups/group-form/group-form.component').then((m) => m.GroupFormComponent),
    data: { titleKey: 'NAV.ADMIN.GROUPS' },
  },
  {
    path: 'services',
    loadComponent: () => import('./pages/services/services.component').then((m) => m.ServicesComponent),
    data: { titleKey: 'NAV.ADMIN.SERVICES' },
  },
  {
    // Paketi has a conditional, nested-list structure (see PackageFormComponent) -
    // a dialog would be too cramped, so unlike the other catalog "šifrarnik"
    // screens its create/edit form is a separate routed page. `:id` is either a
    // real id (edit) or the literal 'new' (create) - PackageFormComponent branches
    // on that instead of registering two near-identical routes.
    path: 'services/packages/:id',
    loadComponent: () =>
      import('./pages/catalog/packages/package-form/package-form.component').then(
        (m) => m.PackageFormComponent,
      ),
    data: { titleKey: 'NAV.ADMIN.SERVICES' },
  },
  {
    path: 'finance',
    loadComponent: () => import('./pages/finance/finance.component').then((m) => m.FinanceComponent),
    data: { titleKey: 'NAV.ADMIN.FINANCE' },
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports/reports.component').then((m) => m.ReportsComponent),
    data: { titleKey: 'NAV.ADMIN.REPORTS' },
  },
];
