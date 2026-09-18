/**
 * Typed replacement for "array of grants means OR" (see the old PAGE_GRANTS/
 * ACTION_GRANTS). A policy still only ever references RAW BACKEND GRANTS -
 * this is a structural cleanup of how the frontend combines/evaluates them,
 * not a new authorization concept (see permission-catalog.spec.ts's own doc
 * for why this deliberately stops short of a capability layer).
 *
 * - `anyOf`: at least one of these grants is required (OR).
 * - `allOf`: every one of these grants is required (AND). Combinable with
 *   `anyOf` - both must be satisfied when both are present.
 * - `supportingAllOf`: grants a UI workflow's lookups/dropdowns need to work
 *   end-to-end, even though the primary business grant above already passed.
 *   Informational only - see evaluatePermissionPolicy's doc for why this is
 *   never folded into the pass/fail boolean automatically.
 * - `ownerOnly`: true restricts the surface to the organization's Owner, no
 *   grant can substitute (mirrors the backend's [RequireOwner], e.g.
 *   GrantGroups/Roles administration).
 *
 * A policy with none of the above set denies by default (fail-closed) - see
 * evaluatePermissionPolicy.
 */
export interface PermissionPolicy {
  readonly anyOf?: readonly string[];
  readonly allOf?: readonly string[];
  readonly supportingAllOf?: readonly string[];
  readonly ownerOnly?: boolean;
}

export interface PermissionEvaluationContext {
  readonly isOwner: boolean;
  readonly grants: readonly string[];
}

/**
 * Pure evaluator (no Angular DI) so it's trivially unit-testable - see
 * permission-policy.spec.ts. CurrentEmployeeService.evaluate() is a thin
 * wrapper over this that supplies live isOwner()/grants state; that's the
 * ONE place owner bypass is decided for every page/action policy in the app.
 *
 * Owner bypass always wins, including over `ownerOnly` (an Owner is
 * trivially "the owner"). Otherwise: `ownerOnly` denies any non-owner
 * outright, regardless of grants. Otherwise: `allOf` (if present) must be
 * fully satisfied AND `anyOf` (if present) must have at least one grant
 * satisfied. A policy with none of anyOf/allOf/ownerOnly set has expressed no
 * requirement at all - treated as a deny, not an accidental fail-open allow.
 *
 * `supportingAllOf` never affects this return value - see
 * PermissionPolicy's own doc and meetsSupportingReads below.
 */
export function evaluatePermissionPolicy(policy: PermissionPolicy, ctx: PermissionEvaluationContext): boolean {
  if (ctx.isOwner) {
    return true;
  }
  if (policy.ownerOnly) {
    return false;
  }
  if (!policy.anyOf && !policy.allOf) {
    return false;
  }
  const allOfOk = !policy.allOf || policy.allOf.every((grant) => ctx.grants.includes(grant));
  const anyOfOk = !policy.anyOf || policy.anyOf.some((grant) => ctx.grants.includes(grant));
  return allOfOk && anyOfOk;
}

/**
 * Whether every one of a policy's `supportingAllOf` grants is present -
 * informational, never gates `can()`/`canPage()` itself (see
 * PermissionPolicy's doc for why). A policy with no `supportingAllOf` at all
 * trivially meets it (nothing was asked for). Owner bypasses this too, same
 * rationale as evaluatePermissionPolicy.
 */
export function meetsSupportingReads(policy: PermissionPolicy, ctx: PermissionEvaluationContext): boolean {
  if (ctx.isOwner) {
    return true;
  }
  return !policy.supportingAllOf || policy.supportingAllOf.every((grant) => ctx.grants.includes(grant));
}
