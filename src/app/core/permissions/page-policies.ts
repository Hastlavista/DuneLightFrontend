import { PermissionPolicy } from './permission-policy.model';

/**
 * Single source of truth for which policy unlocks navigation to each
 * grant-gated admin-section page. Consumed by BOTH admin.routes.ts
 * (grantGuard(pageKey) - blocks direct-URL navigation) and nav-items.ts
 * (NavItem.pageKey - hides the sidebar link), both resolving the SAME
 * PageKey through CurrentEmployeeService.canPage(), so the two can never
 * drift apart the way two independently-maintained literal arrays could.
 *
 * A page not listed here (finance, reports, profile, my-week, today,
 * my-clients, my-groups, my-shifts) is open to every authenticated employee -
 * finance/reports don't have a backing grant yet, and the trainer pages are
 * deliberately ungated (see grant.guard.ts's own doc on why `my-week` in
 * particular must stay reachable by everyone).
 */
export const PAGE_POLICIES = {
  schedule: { anyOf: ['appointments.view', 'appointments.write.own', 'appointments.write.all'] },
  shifts: { anyOf: ['roster.types.view', 'roster.types.manage'] },
  companies: {
    anyOf: ['catalog.companies.view', 'catalog.companies.manage', 'catalog.rooms.view', 'catalog.rooms.manage'],
  },
  clients: { anyOf: ['clients.view', 'clients.manage', 'clients.status.manage', 'clients.anonymize'] },
  employees: { anyOf: ['employees.view', 'employees.manage'] },
  groups: { anyOf: ['groups.view', 'groups.manage'] },
  services: {
    anyOf: [
      'catalog.services.view',
      'catalog.services.manage',
      'catalog.packages.view',
      'catalog.packages.manage',
      'catalog.price-list.view',
      'catalog.price-list.manage',
    ],
  },
  branding: { anyOf: ['organization.branding.manage'] },
  checkout: { anyOf: ['checkout.view', 'checkout.manage'] },
  products: { anyOf: ['products.view', 'products.manage', 'stock.view', 'stock.manage'] },
  dashboard: { anyOf: ['dashboard.view'] },
  commissions: { anyOf: ['commissions.view', 'commissions.manage'] },
  notifications: { anyOf: ['notifications.view'] },
  /** Owner-only frontend surface, no grant can substitute - mirrors the
   * backend's [RequireOwner] on GrantGroupsController/RolesController.
   * ownerGuard evaluates this through the same canPage()/evaluate() path as
   * every grant-gated page, instead of checking isOwner() directly, so owner
   * bypass stays decided in exactly one place (see
   * evaluatePermissionPolicy's doc). */
  permissions: { ownerOnly: true },
} as const satisfies Record<string, PermissionPolicy>;

export type PageKey = keyof typeof PAGE_POLICIES;
