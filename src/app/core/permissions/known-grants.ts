import { ACTION_POLICIES } from './action-policies';
import { KNOWN_RAW_GRANT_KEYS } from './known-raw-grants';
import { PAGE_POLICIES } from './page-policies';
import { PermissionPolicy } from './permission-policy.model';

/**
 * Best-effort static mirror of the backend's grant catalog (~63 entries via
 * GET /api/grants, see permissions.model.ts's GrantDto doc), assembled from
 * every grant string referenced across PAGE_POLICIES/ACTION_POLICIES plus
 * known-raw-grants.ts's flat literal mirror of Grants.cs.
 *
 * This is NOT fetched from the backend (no runtime HTTP dependency here by
 * design - see permission-catalog.spec.ts's own doc) and is therefore not
 * guaranteed complete or automatically kept in sync with a new backend
 * grant. It exists to catch a raw-string TYPO inside this frontend (a grant
 * referenced by a policy that matches nothing else anywhere in the app is
 * almost certainly a mistake), not to guarantee the backend truth.
 *
 * Deliberately NOT derived from CapabilityDefinition metadata (see
 * capability.model.ts) - capabilities are an Owner-facing role-authoring
 * abstraction fetched live from the backend, this is a frontend-only,
 * offline typo net over PermissionPolicy's raw grant strings. Keeping them
 * separate avoids ever needing a runtime HTTP call just to validate a
 * static policy catalog at build/test time (Part Q's capability/runtime
 * isolation, applied here too).
 *
 * True backend-truth validation needs either a backend-generated export of
 * Grants.cs's constants checked into this repo, or a CI-time (never
 * runtime) diff against GET /api/grants - both are CI-phase follow-ups, out
 * of scope for this structural cleanup pass.
 */
function policyGrants(policy: PermissionPolicy): readonly string[] {
  return [...(policy.anyOf ?? []), ...(policy.allOf ?? []), ...(policy.supportingAllOf ?? [])];
}

export const KNOWN_GRANT_KEYS: ReadonlySet<string> = new Set([
  ...Object.values(PAGE_POLICIES).flatMap(policyGrants),
  ...Object.values(ACTION_POLICIES).flatMap(policyGrants),
  ...KNOWN_RAW_GRANT_KEYS,
]);
