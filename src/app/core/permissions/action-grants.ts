/**
 * Single source of truth for which grant(s) unlock an individual UI action -
 * a create/edit/delete/toggle button or an in-place form field - inside a
 * page the user can already reach. Distinct from PAGE_GRANTS, which only
 * gates navigation to the page itself: a user can hold a page's `.view`
 * grant (see PAGE_GRANTS) without holding the `.manage` grant checked here,
 * in which case the page renders but its write actions stay hidden/disabled.
 *
 * Keys follow the `<feature>.<action>` convention. Values mirror the
 * backend's Grants.cs constants 1:1 where the UI action maps to exactly one
 * endpoint's [RequireGrant]; where an action's endpoint accepts either an
 * "own" or "all" grant (see Grants.cs's own/all convention), both are OR-ed
 * here so the button shows for a user holding either one, matching what the
 * endpoint itself would actually allow.
 *
 * UX convention for consumers (see CurrentEmployeeService.can()): hide
 * list/menu-level actions entirely when false (*ngIf); disable in-place
 * form fields on an already-open detail/edit page instead of hiding them.
 */
export const ACTION_GRANTS = {
  'catalog.companies.manage': ['catalog.companies.manage'],
  'catalog.rooms.manage': ['catalog.rooms.manage'],
  'catalog.services.manage': ['catalog.services.manage'],
  'catalog.packages.manage': ['catalog.packages.manage'],
  'catalog.price-list.manage': ['catalog.price-list.manage'],

  'clients.manage': ['clients.manage'],
  'clients.status.manage': ['clients.status.manage'],
  'clients.anonymize': ['clients.anonymize'],
  'clients.tags.manage': ['clients.tags.manage'],
  'clients.packages.manage': ['clients.packages.manage'],

  'employees.manage': ['employees.manage'],
  'employees.role.manage': ['employees.role.manage'],
  'employees.engagement-types.manage': ['employees.engagement-types.manage'],

  'appointments.manage': ['appointments.write.own', 'appointments.write.all'],
  'appointments.delete': ['appointments.delete'],

  'schedule-breaks.manage': ['schedule.breaks.write.own', 'schedule.breaks.write.all'],

  'groups.manage': ['groups.manage'],
  'groups.attendance.manage': ['groups.attendance.own', 'groups.attendance.all'],

  'roster.types.manage': ['roster.types.manage'],
  'roster.entries.manage': ['roster.entries.write.own', 'roster.entries.write.all'],
  'roster.templates.manage': ['roster.templates.manage'],
  'roster.leave-fund.settings.manage': ['roster.leave-fund.settings.manage'],
  'roster.leave-fund.manage': ['roster.leave-fund.manage'],

  'organization.branding.manage': ['organization.branding.manage'],

  'checkout.manage': ['checkout.manage'],

  'products.manage': ['products.manage'],
  'stock.manage': ['stock.manage'],
  'commissions.manage': ['commissions.manage'],
} as const satisfies Record<string, readonly string[]>;

export type ActionKey = keyof typeof ACTION_GRANTS;
