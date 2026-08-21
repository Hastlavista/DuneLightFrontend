/**
 * Curated list of grant keys (see backend Grants.cs) that each open their own
 * screen/capability under /admin - used by adminGuard as "does this user have
 * ANY reason to be in the admin section at all" (OR match, mirrors the
 * backend's [RequireGrant]/GrantContext.HasAny). Grow this list as new admin
 * modules get their own grant - one place, so the guard never needs touching
 * again for that.
 *
 * Deliberately NOT exhaustive of every grant in the catalog:
 * - Mostly `.manage` keys - `.view`-only access doesn't warrant the full
 *   admin shell/nav, and every screen listed here also has a matching `.view`
 *   grant the screen itself checks for read vs. write UI. `appointments.write.all`
 *   is the one deliberate exception (see below - there's no
 *   `appointments.manage` grant at all).
 * - Klijenti is scoped to `clients.status.manage`/`clients.anonymize` only,
 *   not the broader `clients.manage`/`clients.tags.manage`/
 *   `clients.packages.manage` - CONFIRMED intentional: basic client edit
 *   already has its own path through /app/my-clients (a trainer edits there
 *   without needing /admin at all), so /admin/clients is reserved for
 *   administrative actions above that.
 * - Raspored (appointments.*) has no `.manage` grant at all (only
 *   view/write.own/write.all/delete). `appointments.write.all` is included
 *   anyway: /app/today already gives every trainer full transparency into
 *   every termin (an existing, separate decision), so the only thing
 *   /admin/schedule adds on top is the ability to edit OTHER trainers'
 *   termini via any-trainer picker - exactly what write.all represents.
 *   view/write.own/delete stay excluded.
 * - Financije/Izvješća have no grant in the catalog yet - left unprotected
 *   (placeholder pages) until those modules are actually built; add their
 *   `.manage` grant here then.
 */
export const ADMIN_AREA_GRANTS: string[] = [
  // Katalog (Lokacije + Usluge i cjenik tabs)
  'catalog.companies.manage',
  'catalog.services.manage',
  'catalog.packages.manage',
  'catalog.price-list.manage',

  // Zaposlenici (incl. Vrste angažmana tab)
  'employees.manage',
  'employees.engagement-types.manage',

  // Klijenti - see note above on scoping (CONFIRMED intentional)
  'clients.status.manage',
  'clients.anonymize',

  // Grupe
  'groups.manage',

  // Vrste rostera (admin/pages/shifts - the RosterType šifrarnik, not the
  // trainer-facing Roster entries/team-monthly module under /app)
  'roster.types.manage',

  // Raspored - see note above; only write.all, not view/write.own/delete
  'appointments.write.all',
];
