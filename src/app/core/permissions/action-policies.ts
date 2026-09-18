import { PermissionPolicy } from './permission-policy.model';

/**
 * Single source of truth for which grant(s) unlock an individual UI action -
 * a create/edit/delete/toggle button, an in-place form field, or a reusable
 * child-tab visibility check - inside a page the user can already reach.
 * Distinct from PAGE_POLICIES, which only gates navigation to the page
 * itself: a user can hold a page's `.view` grant (see PAGE_POLICIES) without
 * holding the `.manage` grant checked here, in which case the page renders
 * but its write actions stay hidden/disabled.
 *
 * Keys follow the `<feature>.<action>` convention. `anyOf` mirrors the
 * backend's Grants.cs constants 1:1 where the UI action maps to exactly one
 * endpoint's [RequireGrant]; where an action's endpoint accepts either an
 * "own" or "all" grant (see Grants.cs's own/all convention), both are OR-ed
 * so the button shows for a user holding either one, matching what the
 * endpoint itself would actually allow. Own vs. all is deliberately NOT
 * split into separate keys here (e.g. no `appointments.createOwn` /
 * `appointments.createAll`) - no current UI location needs to tell those two
 * apart as separate booleans, only "may attempt this action at all"; actual
 * ownership scoping stays backend-authoritative either way (see
 * PermissionPolicy's own doc on own/all).
 *
 * `supportingAllOf`, where present, documents the extra read grants the
 * action's UI workflow (lookups/dropdowns) needs to work end-to-end - see
 * PermissionPolicy's doc for why this is informational only, never a hard
 * gate on `can()`. Values here are either copied from grant-capabilities.ts's
 * already-vetted `impliedGrants` (same underlying dependency, just mirrored
 * for the runtime policy instead of the permission-editor UI), or newly
 * documented from reading the actual component (see each entry's comment).
 *
 * UX convention for consumers (see CurrentEmployeeService.can()): hide
 * list/menu-level actions entirely when false (*ngIf); disable in-place
 * form fields on an already-open detail/edit page instead of hiding them.
 */
export const ACTION_POLICIES = {
  'catalog.companies.manage': { anyOf: ['catalog.companies.manage'] },
  'catalog.rooms.manage': { anyOf: ['catalog.rooms.manage'] },
  /** Reusable "can see the Rooms tab at all" check - was duplicated
   * identically in company-detail.component.ts and
   * company-form-dialog.component.ts before this catalog entry existed. */
  'catalog.rooms.view': { anyOf: ['catalog.rooms.view', 'catalog.rooms.manage'] },
  'catalog.services.manage': { anyOf: ['catalog.services.manage'] },
  'catalog.packages.manage': { anyOf: ['catalog.packages.manage'] },
  'catalog.price-list.manage': { anyOf: ['catalog.price-list.manage'] },

  'clients.manage': { anyOf: ['clients.manage'] },
  'clients.status.manage': { anyOf: ['clients.status.manage'] },
  'clients.anonymize': { anyOf: ['clients.anonymize'] },
  'clients.tags.manage': { anyOf: ['clients.tags.manage'] },
  'clients.packages.manage': { anyOf: ['clients.packages.manage'] },

  /** supportingAllOf documents a real gap found during Phase 2 inventory -
   * employee-form.component.ts fetches the company/service pickers
   * unconditionally (no grant guard), unlike the analogous
   * today.component.ts/my-week.component.ts pattern. A GrantGroup holding
   * only employees.manage (no catalog.companies.view/catalog.services.view)
   * would 403 on those lookups and silently see empty pickers - reported as
   * a default-role/GrantGroup gap, not fixed here (see Phase 2 report). */
  'employees.manage': { anyOf: ['employees.manage'], supportingAllOf: ['catalog.companies.view', 'catalog.services.view'] },
  'employees.role.manage': { anyOf: ['employees.role.manage'] },
  'employees.engagement-types.manage': { anyOf: ['employees.engagement-types.manage'] },

  /** supportingAllOf copied from grant-capabilities.ts's already-vetted
   * appointments.write.own/.all `impliedGrants` (same real dependency: "Novi
   * termin"'s service/company dropdowns - see NewAppointmentDialogComponent /
   * today.component.ts's dialogServices/dialogCompanies doc comments). */
  'appointments.manage': {
    anyOf: ['appointments.write.own', 'appointments.write.all'],
    supportingAllOf: ['catalog.services.view', 'catalog.companies.view'],
  },
  'appointments.delete': { anyOf: ['appointments.delete'] },

  'schedule-breaks.manage': { anyOf: ['schedule.breaks.write.own', 'schedule.breaks.write.all'] },

  /** supportingAllOf copied from grant-capabilities.ts's groups.manage
   * `impliedGrants` (the trainer picker itself needs no grant - see
   * GroupsService/EmployeesService.getDirectory - only the service/company
   * pickers do). */
  'groups.manage': { anyOf: ['groups.manage'], supportingAllOf: ['catalog.services.view', 'catalog.companies.view'] },
  /** Deliberately no supportingAllOf: appointments.view (needed for the
   * Phase-4 correction/waitlist sub-features) is NOT required for this
   * action's own core checkbox check-in/out flow - see
   * GroupAttendanceDialogComponent.hasAppointmentsView's own doc, left local
   * on purpose since it gates a different, optional slice of that dialog. */
  'groups.attendance.manage': { anyOf: ['groups.attendance.own', 'groups.attendance.all'] },

  'roster.types.manage': { anyOf: ['roster.types.manage'] },
  'roster.entries.manage': { anyOf: ['roster.entries.write.own', 'roster.entries.write.all'] },
  'roster.templates.manage': { anyOf: ['roster.templates.manage'] },
  /** Reusable "can see the working-hours/holidays tabs at all" check - was
   * duplicated identically in company-detail.component.ts,
   * company-form-dialog.component.ts (×2, working-hours AND holidays share
   * this grant pair) and employee-form.component.ts before this entry
   * existed. */
  'roster.templates.view': { anyOf: ['roster.templates.view', 'roster.templates.manage'] },
  'roster.leave-fund.settings.manage': { anyOf: ['roster.leave-fund.settings.manage'] },
  'roster.leave-fund.manage': { anyOf: ['roster.leave-fund.manage'] },

  'organization.branding.manage': { anyOf: ['organization.branding.manage'] },

  /** supportingAllOf copied from grant-capabilities.ts's checkout.manage
   * `impliedGrants` - a Checkout's items reference Bookings/Packages/
   * Products, so its add-item workflow needs all four reads. */
  'checkout.manage': {
    anyOf: ['checkout.manage'],
    supportingAllOf: ['appointments.view', 'catalog.packages.view', 'products.view', 'stock.view'],
  },

  'products.manage': { anyOf: ['products.manage'] },
  'stock.manage': { anyOf: ['stock.manage'] },
  'commissions.manage': { anyOf: ['commissions.manage'] },
} as const satisfies Record<string, PermissionPolicy>;

export type ActionKey = keyof typeof ACTION_POLICIES;
