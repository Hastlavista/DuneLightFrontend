import {
  CapabilityDefinitionDto,
  CapabilityDefinitionGrantDto,
  CapabilityGrantRole,
  CapabilityScopeModel,
  CapabilitySelectedScope,
  GrantGroupTemplateMatchDto,
} from '../models/capability.model';

/**
 * FAZA 1 Parts I/J/K/L/M - pure, read-only mirror of the backend's
 * CapabilityMaterializationService resolution table (see that service's own
 * doc for the authoritative algorithm). Used ONLY to INTERPRET an already-
 * persisted raw grant array for display (role summary, Advanced-mode
 * provenance partitioning, drifted-group reconstruction) - never to compute a
 * payload sent back to the backend. There is no capability-aware GrantGroup
 * create/update endpoint in this phase (see CapabilitiesController's own
 * doc); Angular must not pretend otherwise by silently materializing a raw
 * grant set and saving it through the raw grants endpoint (see
 * grant-group-form.component.ts's own doc on what Save actually persists).
 */

/** Legal CapacitySelectedScope values for a given ScopeModel, in display order. */
export function legalScopesFor(scopeModel: CapabilityScopeModel): CapabilitySelectedScope[] {
  switch (scopeModel) {
    case 'None':
      return ['None', 'On'];
    case 'ViewManage':
      return ['None', 'View', 'Manage'];
    case 'OwnAll':
      return ['None', 'Own', 'All'];
    case 'ViewOwnAll':
      return ['None', 'View', 'Own', 'All'];
  }
}

function grantsWithRole(grants: readonly CapabilityDefinitionGrantDto[], role: CapabilityGrantRole): string[] {
  return grants.filter((g) => g.role === role).map((g) => g.grantKey);
}

/** Raw grant keys a capability's SelectedScope activates, mirroring
 * CapabilityMaterializationService.Materialize exactly:
 * - None: On -> PrimaryNoScope.
 * - ViewManage: View -> PrimaryViewOnly; Manage -> PrimaryViewOnly + PrimaryManage.
 * - OwnAll: Own -> PrimaryOwn; All -> PrimaryAll (NEVER Own).
 * - ViewOwnAll: View -> PrimaryViewOnly; Own -> PrimaryViewOnly + PrimaryOwn; All -> PrimaryViewOnly + PrimaryAll.
 * MandatorySupporting rows are included whenever selectedScope !== 'None'.
 * selectedScope === 'None' always returns an empty set. */
export function materializeCapability(
  scopeModel: CapabilityScopeModel,
  selectedScope: CapabilitySelectedScope,
  grants: readonly CapabilityDefinitionGrantDto[],
): Set<string> {
  const result = new Set<string>();
  if (selectedScope === 'None') {
    return result;
  }

  const add = (role: CapabilityGrantRole) => grantsWithRole(grants, role).forEach((key) => result.add(key));

  switch (scopeModel) {
    case 'None':
      add('PrimaryNoScope');
      break;
    case 'ViewManage':
      if (selectedScope === 'View' || selectedScope === 'Manage') {
        add('PrimaryViewOnly');
      }
      if (selectedScope === 'Manage') {
        add('PrimaryManage');
      }
      break;
    case 'OwnAll':
      if (selectedScope === 'Own') {
        add('PrimaryOwn');
      }
      if (selectedScope === 'All') {
        add('PrimaryAll');
      }
      break;
    case 'ViewOwnAll':
      if (selectedScope === 'View' || selectedScope === 'Own' || selectedScope === 'All') {
        add('PrimaryViewOnly');
      }
      if (selectedScope === 'Own') {
        add('PrimaryOwn');
      }
      if (selectedScope === 'All') {
        add('PrimaryAll');
      }
      break;
  }

  add('MandatorySupporting');
  return result;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((key) => b.has(key));
}

/** Per-capability reconstruction result for one GrantGroup's raw grants. */
export interface CapabilitySelectionResult {
  capability: CapabilityDefinitionDto;
  /** The scope that EXACTLY matches this capability's currently-active raw
   * grants, or 'None' if none are active, or null if the active subset
   * doesn't cleanly match any legal scope (drifted/ambiguous - see
   * CapabilityMaterializationService's own doc; those raw grants are left
   * unclaimed rather than guessed at, per Part L's "prefer preservation over
   * normalization"). */
  selectedScope: CapabilitySelectedScope | null;
  /** Raw grant keys this capability's resolved scope explains - empty unless
   * selectedScope is non-null and non-'None'. */
  claimedGrantKeys: ReadonlySet<string>;
}

/** Best-effort LOCAL reconstruction of every capability's selected scope from
 * a raw grant array alone (no backend snapshot) - used for drifted/custom
 * GrantGroups (GrantGroupTemplateMatchDto.hasSnapshotMetadata === false, see
 * Part L) and for a brand-new, not-yet-saved GrantGroup. Exact-set-match
 * only: a capability whose active raw grants don't equal exactly one legal
 * scope's materialized set is reported as unmatched (selectedScope: null),
 * NOT silently coerced into the closest guess. */
export function reconstructCapabilitySelections(
  capabilities: readonly CapabilityDefinitionDto[],
  rawGrants: ReadonlySet<string>,
): CapabilitySelectionResult[] {
  return capabilities.map((capability) => {
    const ownKeys = new Set(capability.grants.map((g) => g.grantKey));
    const active = new Set([...ownKeys].filter((key) => rawGrants.has(key)));

    if (active.size === 0) {
      return { capability, selectedScope: 'None', claimedGrantKeys: new Set<string>() };
    }

    for (const candidate of legalScopesFor(capability.scopeModel)) {
      if (candidate === 'None') {
        continue;
      }
      const materialized = materializeCapability(capability.scopeModel, candidate, capability.grants);
      if (setsEqual(active, materialized)) {
        return { capability, selectedScope: candidate, claimedGrantKeys: materialized };
      }
    }

    return { capability, selectedScope: null, claimedGrantKeys: new Set<string>() };
  });
}

export type ProvenanceSource = 'capability' | 'template' | 'manual';

export interface GrantProvenance {
  grantKey: string;
  source: ProvenanceSource;
  /** Set when source === 'capability': which capability (and at what scope)
   * explains this raw grant - shown as diagnostics in Advanced mode. */
  capabilityKey?: string;
  selectedScope?: CapabilitySelectedScope;
  /** Set when source === 'template': the template that contributed this raw
   * grant as a compatibility-extra (not tied to any single capability). */
  sourceTemplateKey?: string;
  sourceTemplateVersion?: number;
}

export interface CapabilityReconstruction {
  /** Per-capability selection results - null selectedScope means "present but
   * not cleanly derivable" (see reconstructCapabilitySelections's own doc). */
  selections: CapabilitySelectionResult[];
  /** Every raw grant currently on the group, tagged with why it's there. */
  provenance: GrantProvenance[];
  /** provenance entries with source === 'manual' - directly Owner-editable in
   * Advanced mode. Never includes a grant the algorithm above could also
   * explain as capability- or template-derived (Part K's "Scenario-E"
   * prevention: a grant cannot be both derived AND manually claimed at once). */
  manualGrantKeys: ReadonlySet<string>;
  /** True when the group carries NO backend snapshot metadata at all - a
   * custom/drifted group whose capability selections above are a local
   * best-effort reconstruction, not backend-confirmed (see Part L/M). */
  isCustomized: boolean;
}

/** Combines capability-derived and template-compatibility-derived provenance
 * for one GrantGroup's raw grants into a single partition Advanced mode can
 * render (Part J). Prefers the backend's own snapshot
 * (GrantGroupTemplateMatchDto) when available - it's server-confirmed, not a
 * guess - and only falls back to local reconstruction for drifted/custom
 * groups or a brand-new group with no snapshot yet. */
export function reconstructGrantProvenance(
  capabilities: readonly CapabilityDefinitionDto[],
  rawGrants: readonly string[],
  templateMatch: GrantGroupTemplateMatchDto | null,
): CapabilityReconstruction {
  const rawSet = new Set(rawGrants);

  let selections: CapabilitySelectionResult[];
  const capabilityClaimed = new Map<string, { capabilityKey: string; selectedScope: CapabilitySelectedScope }>();

  if (templateMatch?.hasSnapshotMetadata) {
    // Backend-confirmed: trust the snapshot's selections instead of guessing.
    selections = capabilities.map((capability) => {
      const snapshot = templateMatch.snapshots.find((s) => s.capabilityKey === capability.key);
      if (!snapshot) {
        return { capability, selectedScope: 'None', claimedGrantKeys: new Set<string>() };
      }
      const materialized = materializeCapability(capability.scopeModel, snapshot.selectedScope, capability.grants);
      materialized.forEach((key) =>
        capabilityClaimed.set(key, { capabilityKey: capability.key, selectedScope: snapshot.selectedScope }),
      );
      return { capability, selectedScope: snapshot.selectedScope, claimedGrantKeys: materialized };
    });
  } else {
    selections = reconstructCapabilitySelections(capabilities, rawSet);
    for (const result of selections) {
      if (result.selectedScope && result.selectedScope !== 'None') {
        result.claimedGrantKeys.forEach((key) =>
          capabilityClaimed.set(key, { capabilityKey: result.capability.key, selectedScope: result.selectedScope! }),
        );
      }
    }
  }

  const templateClaimed = new Map<string, { key: string; version: number }>();
  if (templateMatch?.hasSnapshotMetadata) {
    for (const grant of templateMatch.templateGrants) {
      templateClaimed.set(grant.grantKey, { key: grant.sourceTemplateKey, version: grant.sourceTemplateVersion });
    }
  }

  const provenance: GrantProvenance[] = rawGrants.map((grantKey) => {
    const capClaim = capabilityClaimed.get(grantKey);
    if (capClaim) {
      return {
        grantKey,
        source: 'capability',
        capabilityKey: capClaim.capabilityKey,
        selectedScope: capClaim.selectedScope,
      };
    }
    const templateClaim = templateClaimed.get(grantKey);
    if (templateClaim) {
      return {
        grantKey,
        source: 'template',
        sourceTemplateKey: templateClaim.key,
        sourceTemplateVersion: templateClaim.version,
      };
    }
    return { grantKey, source: 'manual' };
  });

  const manualGrantKeys = new Set(provenance.filter((p) => p.source === 'manual').map((p) => p.grantKey));

  return {
    selections,
    provenance,
    manualGrantKeys,
    isCustomized: !templateMatch?.hasSnapshotMetadata,
  };
}
