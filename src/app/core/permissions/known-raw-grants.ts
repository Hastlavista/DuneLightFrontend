/**
 * Flat mirror of the backend's raw grant-key catalog (BlueDragon.DuneLight.
 * Core.Shared.Grants, 63 entries as of FAZA 1) - kept ONLY as a typo-safety
 * net for known-grants.ts/permission-catalog.spec.ts (see their own docs).
 * This is NOT a capability taxonomy and must not become one - it carries no
 * label/description/grouping, just the literal strings, so it can never
 * compete with CapabilityDefinition metadata (see capability.model.ts) as a
 * second "source of truth" for the role editor (Part D).
 *
 * NOT fetched from the backend (no runtime HTTP dependency here by design,
 * same rationale as this file's predecessor) and therefore not guaranteed to
 * stay in perfect sync with a brand-new backend grant - a CI-time diff
 * against GET /api/grants remains the real follow-up (see known-grants.ts).
 */
export const KNOWN_RAW_GRANT_KEYS: ReadonlySet<string> = new Set([
  'employees.directory.view',
  'employees.view',
  'employees.manage',
  'employees.role.manage',
  'employees.engagement-types.view',
  'employees.engagement-types.manage',

  'catalog.companies.view',
  'catalog.companies.manage',
  'catalog.services.view',
  'catalog.services.manage',
  'catalog.packages.view',
  'catalog.packages.manage',
  'catalog.price-list.view',
  'catalog.price-list.manage',
  'catalog.rooms.view',
  'catalog.rooms.manage',

  'clients.view',
  'clients.manage',
  'clients.status.manage',
  'clients.anonymize',
  'clients.tags.view',
  'clients.tags.manage',
  'clients.packages.view',
  'clients.packages.manage',

  'appointments.view',
  'appointments.write.own',
  'appointments.write.all',
  'appointments.delete',

  'schedule.breaks.view',
  'schedule.breaks.write.own',
  'schedule.breaks.write.all',

  'groups.view',
  'groups.manage',
  'groups.attendance.view',
  'groups.attendance.own',
  'groups.attendance.all',

  'roster.types.view',
  'roster.types.manage',
  'roster.entries.view',
  'roster.entries.write.own',
  'roster.entries.write.all',
  'roster.reviews.team.view',
  'roster.reviews.personal.view.own',
  'roster.reviews.personal.view.all',
  'roster.templates.view',
  'roster.templates.manage',
  'roster.leave-fund.settings.view',
  'roster.leave-fund.settings.manage',
  'roster.leave-fund.view.own',
  'roster.leave-fund.view.all',
  'roster.leave-fund.manage',

  'organization.branding.manage',
  'organization.settings.manage',

  'checkout.view',
  'checkout.manage',

  'products.view',
  'products.manage',
  'stock.view',
  'stock.manage',

  'commissions.view',
  'commissions.manage',

  'dashboard.view',

  'notifications.view',
]);
