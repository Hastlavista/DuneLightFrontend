/**
 * Single source of truth for which grant(s) unlock navigation to each
 * grant-gated admin-section page. Consumed by BOTH admin.routes.ts
 * (grantGuard - blocks direct-URL navigation) and nav-items.ts
 * (requiredGrants - hides the sidebar link), so the two can never drift
 * apart the way two independently-maintained literal arrays could.
 *
 * OR-matched against CurrentEmployeeService.hasAnyGrant() - same semantics
 * as the backend's [RequireGrant]. A page not listed here (finance, reports,
 * profile) is open to every authenticated employee -
 * finance/reports don't have a backing grant yet.
 */
export const PAGE_GRANTS = {
  schedule: ['appointments.view', 'appointments.write.own', 'appointments.write.all'],
  shifts: ['roster.types.view', 'roster.types.manage'],
  companies: ['catalog.companies.view', 'catalog.companies.manage', 'catalog.rooms.view', 'catalog.rooms.manage'],
  clients: ['clients.view', 'clients.manage', 'clients.status.manage', 'clients.anonymize'],
  employees: ['employees.view', 'employees.manage'],
  groups: ['groups.view', 'groups.manage'],
  services: [
    'catalog.services.view',
    'catalog.services.manage',
    'catalog.packages.view',
    'catalog.packages.manage',
    'catalog.price-list.view',
    'catalog.price-list.manage',
  ],
  branding: ['organization.branding.manage'],
  checkout: ['checkout.view', 'checkout.manage'],
  products: ['products.view', 'products.manage', 'stock.view', 'stock.manage'],
  dashboard: ['dashboard.view'],
  commissions: ['commissions.view', 'commissions.manage'],
  notifications: ['notifications.view'],
} as const satisfies Record<string, readonly string[]>;

export type PageGrantKey = keyof typeof PAGE_GRANTS;
