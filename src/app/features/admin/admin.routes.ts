import { Routes } from '@angular/router';
import { ownerGuard } from '../../core/guards/owner.guard';
import { brandingGuard } from '../../core/guards/branding.guard';
import { grantGuard } from '../../core/guards/grant.guard';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    canActivate: [grantGuard('dashboard')],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    data: { titleKey: 'NAV.ADMIN.DASHBOARD' },
  },
  {
    path: 'commissions',
    canActivate: [grantGuard('commissions')],
    loadComponent: () => import('./pages/commissions/commissions.component').then((m) => m.CommissionsComponent),
    data: { titleKey: 'NAV.ADMIN.COMMISSIONS' },
  },
  {
    path: 'notifications',
    canActivate: [grantGuard('notifications')],
    loadComponent: () => import('./pages/notifications/notifications.component').then((m) => m.NotificationsComponent),
    data: { titleKey: 'NAV.ADMIN.NOTIFICATIONS' },
  },
  {
    path: 'schedule',
    canActivate: [grantGuard('schedule')],
    loadComponent: () => import('./pages/schedule/schedule.component').then((m) => m.ScheduleComponent),
    data: { titleKey: 'NAV.ADMIN.SCHEDULE' },
  },
  {
    path: 'shifts',
    canActivate: [grantGuard('shifts')],
    loadComponent: () => import('./pages/shifts/shifts.component').then((m) => m.ShiftsComponent),
    data: { titleKey: 'NAV.ADMIN.SHIFTS' },
  },
  {
    path: 'companies',
    canActivate: [grantGuard('companies')],
    loadComponent: () =>
      import('./pages/catalog/companies/companies.component').then((m) => m.CompaniesComponent),
    data: { titleKey: 'NAV.ADMIN.COMPANIES' },
  },
  {
    path: 'companies/:id',
    canActivate: [grantGuard('companies')],
    loadComponent: () =>
      import('./pages/catalog/companies/company-detail.component').then((m) => m.CompanyDetailComponent),
    data: { titleKey: 'NAV.ADMIN.COMPANIES' },
  },
  {
    path: 'checkout',
    canActivate: [grantGuard('checkout')],
    loadComponent: () =>
      import('./pages/checkout/checkout-entry.component').then((m) => m.CheckoutEntryComponent),
    data: { titleKey: 'NAV.ADMIN.CHECKOUT' },
  },
  {
    // Same convention as 'companies/:id' - separate routed detail page, `:id`
    // is always a real Checkout id (no 'new' - Checkout creation happens
    // inline on CheckoutEntryComponent, not on this route).
    path: 'checkout/:id',
    canActivate: [grantGuard('checkout')],
    loadComponent: () =>
      import('./pages/checkout/checkout-detail.component').then((m) => m.CheckoutDetailComponent),
    data: { titleKey: 'NAV.ADMIN.CHECKOUT' },
  },
  {
    path: 'clients',
    canActivate: [grantGuard('clients')],
    loadComponent: () => import('./pages/clients/clients.component').then((m) => m.ClientsComponent),
    data: { titleKey: 'NAV.ADMIN.CLIENTS' },
  },
  {
    // Same convention as 'employees/:id' - the create/edit form is a separate
    // routed page (uklj. tab s paketima klijenta), `:id` is either a real id
    // (edit) or the literal 'new' (create).
    path: 'clients/:id',
    canActivate: [grantGuard('clients')],
    loadComponent: () =>
      import('./pages/clients/client-form/client-form.component').then((m) => m.ClientFormComponent),
    data: { titleKey: 'NAV.ADMIN.CLIENTS' },
  },
  {
    path: 'employees',
    canActivate: [grantGuard('employees')],
    loadComponent: () => import('./pages/employees/employees.component').then((m) => m.EmployeesComponent),
    data: { titleKey: 'NAV.ADMIN.EMPLOYEES' },
  },
  {
    // Same convention as 'services/packages/:id' - the create/edit form is a
    // separate routed page (not a modal, the form is too large), `:id` is
    // either a real id (edit) or the literal 'new' (create).
    path: 'employees/:id',
    canActivate: [grantGuard('employees')],
    loadComponent: () =>
      import('./pages/employees/employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
    data: { titleKey: 'NAV.ADMIN.EMPLOYEES' },
  },
  {
    path: 'groups',
    canActivate: [grantGuard('groups')],
    loadComponent: () => import('./pages/groups/groups.component').then((m) => m.GroupsComponent),
    data: { titleKey: 'NAV.ADMIN.GROUPS' },
  },
  {
    // Same convention as 'employees/:id' - the create/edit/detail page is a
    // separate routed page, `:id` is either a real id (edit/detail) or the
    // literal 'new' (create).
    path: 'groups/:id',
    canActivate: [grantGuard('groups')],
    loadComponent: () => import('./pages/groups/group-form/group-form.component').then((m) => m.GroupFormComponent),
    data: { titleKey: 'NAV.ADMIN.GROUPS' },
  },
  {
    path: 'services',
    canActivate: [grantGuard('services')],
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
    canActivate: [grantGuard('services')],
    loadComponent: () =>
      import('./pages/catalog/packages/package-form/package-form.component').then(
        (m) => m.PackageFormComponent,
      ),
    data: { titleKey: 'NAV.ADMIN.SERVICES' },
  },
  {
    path: 'products',
    canActivate: [grantGuard('products')],
    loadComponent: () => import('./pages/products/products.component').then((m) => m.ProductsComponent),
    data: { titleKey: 'NAV.ADMIN.PRODUCTS' },
  },
  {
    path: 'permissions',
    canActivate: [ownerGuard],
    loadComponent: () => import('./pages/permissions/permissions.component').then((m) => m.PermissionsComponent),
    data: { titleKey: 'NAV.ADMIN.PERMISSIONS' },
  },
  {
    path: 'branding',
    canActivate: [brandingGuard],
    loadComponent: () => import('./pages/branding/branding.component').then((m) => m.BrandingComponent),
    data: { titleKey: 'NAV.ADMIN.BRANDING' },
  },
  {
    // Same convention as 'employees/:id' - separate routed page, `:id` is
    // either a real id (edit) or the literal 'new' (create).
    path: 'permissions/grant-groups/:id',
    canActivate: [ownerGuard],
    loadComponent: () =>
      import('./pages/permissions/grant-groups/grant-group-form/grant-group-form.component').then(
        (m) => m.GrantGroupFormComponent,
      ),
    data: { titleKey: 'NAV.ADMIN.PERMISSIONS' },
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
  {
    // Shared with trainer.routes.ts ('app/profile') - same component either way,
    // see ProfileComponent.
    path: 'profile',
    loadComponent: () => import('../profile/profile.component').then((m) => m.ProfileComponent),
    data: { titleKey: 'NAV.ADMIN.PROFILE' },
  },
];
