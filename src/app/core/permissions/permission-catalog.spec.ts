import { ACTION_POLICIES } from './action-policies';
import { KNOWN_GRANT_KEYS } from './known-grants';
import { KNOWN_RAW_GRANT_KEYS } from './known-raw-grants';
import { PAGE_POLICIES } from './page-policies';
import { PermissionPolicy } from './permission-policy.model';

/**
 * Structural/consistency checks over PAGE_POLICIES and ACTION_POLICIES - the
 * "lightweight validation test" from Phase 2's Part K. This is deliberately
 * NOT a check against the backend's real grant catalog (no runtime HTTP
 * dependency, no backend source reachable from this repo - see
 * known-grants.ts's own doc for the CI-phase follow-up this defers to).
 * What it DOES catch: a policy that expresses no requirement at all (would
 * silently deny/allow depending on a bug), and a grant string that doesn't
 * match the `<feature>.<action>` naming convention (a stray typo).
 */
const GRANT_KEY_PATTERN = /^[a-z][a-z-]*(\.[a-z][a-z-]*)+$/;

function allGrantsOf(policy: PermissionPolicy): readonly string[] {
  return [...(policy.anyOf ?? []), ...(policy.allOf ?? []), ...(policy.supportingAllOf ?? [])];
}

describe('PAGE_POLICIES / ACTION_POLICIES structure', () => {
  const allPolicies: Record<string, PermissionPolicy> = { ...PAGE_POLICIES, ...ACTION_POLICIES };

  it('every entry expresses at least one requirement (anyOf or allOf)', () => {
    for (const [key, policy] of Object.entries(allPolicies)) {
      const expressesRequirement = !!policy.anyOf || !!policy.allOf;
      if (!expressesRequirement) {
        throw new Error(`policy "${key}" expresses no requirement at all`);
      }
    }
  });

  it('every referenced grant matches the "<feature>.<action>" naming convention', () => {
    for (const [key, policy] of Object.entries(allPolicies)) {
      for (const grant of allGrantsOf(policy)) {
        if (!GRANT_KEY_PATTERN.test(grant)) {
          throw new Error(`policy "${key}" references malformed grant "${grant}"`);
        }
      }
    }
  });

  it('every referenced grant is a member of the known-grants union', () => {
    for (const [key, policy] of Object.entries(allPolicies)) {
      for (const grant of allGrantsOf(policy)) {
        if (!KNOWN_GRANT_KEYS.has(grant)) {
          throw new Error(`policy "${key}" references unknown grant "${grant}"`);
        }
      }
    }
  });
});

/** Minimal edit distance - just enough to flag a near-miss typo (one
 * character off) between two grant strings that are NOT already identical. */
function levenshtein(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] =
        a[i - 1] === b[j - 1]
          ? rows[i - 1][j - 1]
          : 1 + Math.min(rows[i - 1][j], rows[i][j - 1], rows[i - 1][j - 1]);
    }
  }
  return rows[a.length][b.length];
}

describe('ACTION_POLICIES/PAGE_POLICIES vs. known-raw-grants.ts drift', () => {
  /** known-raw-grants.ts is a flat, independently-maintained mirror of the
   * real backend grant catalog (see its own doc). A one-character typo in
   * either place (e.g. "catalog.service.manage" vs. "catalog.services.manage")
   * would otherwise silently create two "different" grants that both look
   * plausible - this flags any near-miss (edit distance 1-2) that ISN'T
   * already an exact match. */
  const knownGrants = [...KNOWN_RAW_GRANT_KEYS];

  it('has no near-miss (likely-typo) grant strings against known-raw-grants.ts', () => {
    const policyGrants = new Set([...Object.values(PAGE_POLICIES), ...Object.values(ACTION_POLICIES)].flatMap(allGrantsOf));
    for (const grant of policyGrants) {
      if (knownGrants.includes(grant)) {
        continue;
      }
      const nearMiss = knownGrants.find((known) => levenshtein(grant, known) <= 2 && levenshtein(grant, known) > 0);
      if (nearMiss) {
        throw new Error(`"${grant}" looks like a typo of known grant "${nearMiss}"`);
      }
    }
  });
});
