/**
 * Typed replacement for "array of grants means OR" (see the old PAGE_GRANTS/
 * ACTION_GRANTS). A policy only ever references RAW BACKEND GRANTS - this is
 * a structural cleanup of how the frontend combines/evaluates them, not a new
 * authorization concept (see permission-catalog.spec.ts's own doc for why
 * this deliberately stops short of a capability layer).
 *
 * Grant-only Tenant Authorization Refactor: there is no Owner bypass and no
 * `ownerOnly` policy shape any more. The organization's founder is granted
 * access exclusively through being assigned to the Admin starter GrantGroup
 * at registration (see AuthService.Register) - by the time this evaluator
 * runs, they are just another user with grants, same as everyone else.
 *
 * - `anyOf`: at least one of these grants is required (OR).
 * - `allOf`: every one of these grants is required (AND). Combinable with
 *   `anyOf` - both must be satisfied when both are present.
 * - `supportingAllOf`: grants a UI workflow's lookups/dropdowns need to work
 *   end-to-end, even though the primary business grant above already passed.
 *   Informational only - see evaluatePermissionPolicy's doc for why this is
 *   never folded into the pass/fail boolean automatically.
 *
 * A policy with none of the above set denies by default (fail-closed) - see
 * evaluatePermissionPolicy.
 */
export interface PermissionPolicy {
  readonly anyOf?: readonly string[];
  readonly allOf?: readonly string[];
  readonly supportingAllOf?: readonly string[];
}

export interface PermissionEvaluationContext {
  readonly grants: readonly string[];
}

/**
 * Pure evaluator (no Angular DI) so it's trivially unit-testable - see
 * permission-policy.spec.ts. CurrentEmployeeService.evaluate() is a thin
 * wrapper over this that supplies live grants state.
 *
 * `allOf` (if present) must be fully satisfied AND `anyOf` (if present) must
 * have at least one grant satisfied. A policy with neither anyOf nor allOf
 * set has expressed no requirement at all - treated as a deny, not an
 * accidental fail-open allow.
 *
 * `supportingAllOf` never affects this return value - see
 * PermissionPolicy's own doc and meetsSupportingReads below.
 */
export function evaluatePermissionPolicy(policy: PermissionPolicy, ctx: PermissionEvaluationContext): boolean {
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
 * trivially meets it (nothing was asked for).
 */
export function meetsSupportingReads(policy: PermissionPolicy, ctx: PermissionEvaluationContext): boolean {
  return !policy.supportingAllOf || policy.supportingAllOf.every((grant) => ctx.grants.includes(grant));
}
