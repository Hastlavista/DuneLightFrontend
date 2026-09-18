import { ALL_CAPABILITIES } from '../../features/admin/pages/permissions/grant-groups/grant-group-form/grant-capabilities';
import { ACTION_POLICIES } from './action-policies';
import { PAGE_POLICIES } from './page-policies';
import { PermissionPolicy } from './permission-policy.model';

/**
 * Best-effort static mirror of the backend's grant catalog (~42 entries via
 * GET /api/grants, see permissions.model.ts's GrantDto doc), assembled from
 * every grant string referenced across PAGE_POLICIES, ACTION_POLICIES and
 * grant-capabilities.ts's CAPABILITY_SECTIONS - computed, not hand-copied,
 * so it can never drift from the catalogs it mirrors.
 *
 * This is NOT fetched from the backend (no runtime HTTP dependency here by
 * design - see permission-catalog.spec.ts's own doc) and is therefore not
 * guaranteed complete or automatically kept in sync with a new backend
 * grant. It exists to catch a raw-string TYPO inside this frontend (a grant
 * referenced by a policy that matches nothing else anywhere in the app is
 * almost certainly a mistake), not to guarantee the backend truth.
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
  ...ALL_CAPABILITIES.flatMap((capability) => [capability.primaryGrant, ...capability.impliedGrants]),
]);
