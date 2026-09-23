/**
 * FAZA 1 Part C - typed mirror of the backend's capability metadata
 * (BlueDragon.DuneLight.Core.DTOs.Capabilities.CapabilityDtos). These are
 * AUTHORING-TIME metadata only - they describe which raw grants a GrantGroup
 * receives when an Owner configures a role. Runtime authorization never reads
 * these; it stays on GrantGroup -> GrantGroupGrant -> raw Grants.cs keys (see
 * permission-policy.model.ts's PermissionPolicy, evaluated against
 * CurrentEmployee.grants).
 *
 * Backend metadata is language-neutral by design (no DisplayNameHr/
 * DescriptionHr) - the frontend localizes every label/description itself,
 * keyed off `key`/`categoryKey` (see capability-presentation.ts).
 *
 * `key` and `categoryKey` are kept as plain `string`, not a union of the 32
 * known values - a backend key the frontend has no translation for yet must
 * still render (fallback presentation), never crash parsing (see Part S).
 */

/** Legal selected-scope values differ per ScopeModel - see CapabilityScopeModel's own doc. */
export type CapabilityScopeModel = 'None' | 'ViewManage' | 'OwnAll' | 'ViewOwnAll';

export type CapabilitySensitivity = 'Normal' | 'Sensitive' | 'HighRisk';

export type CapabilitySelectedScope = 'None' | 'View' | 'Manage' | 'Own' | 'All' | 'On';

/** Which CapabilitySelectedScope materializes a given raw grant row - see
 * CapabilityMaterializationService's doc for the exact resolution table. */
export type CapabilityGrantRole =
  | 'PrimaryOwn'
  | 'PrimaryAll'
  | 'PrimaryViewOnly'
  | 'PrimaryManage'
  | 'PrimaryNoScope'
  | 'MandatorySupporting';

export interface CapabilityDefinitionGrantDto {
  grantKey: string;
  role: CapabilityGrantRole;
}

/** GET /api/permissions/capabilities and GET /api/permissions/capabilities/{key} (permissions.view/permissions.manage). */
export interface CapabilityDefinitionDto {
  id: string;
  key: string;
  version: number;
  categoryKey: string;
  scopeModel: CapabilityScopeModel;
  sensitivity: CapabilitySensitivity;
  isActive: boolean;
  deprecatedAt: string | null;
  grants: CapabilityDefinitionGrantDto[];
}

export interface DefaultRoleTemplateCapabilityDto {
  capabilityDefinitionId: string;
  capabilityKey: string;
  capabilityVersion: number;
  selectedScope: CapabilitySelectedScope;
}

export type DefaultRoleTemplateGrantReason = string;

export interface DefaultRoleTemplateGrantDto {
  grantKey: string;
  reason: DefaultRoleTemplateGrantReason;
}

/** GET /api/permissions/role-templates and GET /api/permissions/role-templates/{key} (permissions.view/permissions.manage). */
export interface DefaultRoleTemplateDto {
  id: string;
  key: string;
  version: number;
  displayNameHr: string;
  isActive: boolean;
  capabilities: DefaultRoleTemplateCapabilityDto[];
  compatibilityGrants: DefaultRoleTemplateGrantDto[];
}

export interface GrantGroupCapabilitySnapshotDto {
  capabilityDefinitionId: string;
  capabilityKey: string;
  capabilityVersion: number;
  selectedScope: CapabilitySelectedScope;
  sourceTemplateKey: string | null;
  sourceTemplateVersion: number | null;
  appliedAt: string;
}

export interface GrantGroupTemplateGrantDto {
  grantKey: string;
  sourceTemplateKey: string;
  sourceTemplateVersion: number;
  appliedAt: string;
}

/** GET /api/permissions/grant-groups/{id}/template-match (permissions.view/permissions.manage).
 * `hasSnapshotMetadata: false` means the group has no capability provenance
 * at all - either genuinely custom, or predates the FAZA 1 migration (see
 * grant-group-form.component.ts's drifted-group handling, Part L). */
export interface GrantGroupTemplateMatchDto {
  grantGroupId: string;
  hasSnapshotMetadata: boolean;
  sourceTemplateKey: string | null;
  sourceTemplateVersion: number | null;
  snapshots: GrantGroupCapabilitySnapshotDto[];
  templateGrants: GrantGroupTemplateGrantDto[];
}

/** Authoritative capability authoring state for a GrantGroup. Unlike the
 * template-match endpoint, this is the source of truth for both custom and
 * template-backed capability-managed groups. */
export interface GrantGroupAuthoringStateDto {
  grantGroup: import('./permissions.model').GrantGroupDto;
  capabilitySelections: DefaultRoleTemplateCapabilityDto[];
  manualGrantKeys: string[];
  derivedGrantKeys: string[];
  templateSourceKey: string | null;
  templateSourceVersion: number | null;
  hasCapabilityMetadata: boolean;
  isCustomized: boolean;
}

/** Body accepted by the capability-aware GrantGroup create/update endpoints. */
export interface GrantGroupCapabilityWriteRequest {
  name: string;
  capabilitySelections: Array<{
    capabilityKey: string;
    capabilityVersion: number;
    selectedScope: CapabilitySelectedScope;
  }>;
  manualGrantKeys: string[];
}

/**
 * DefaultRoleTemplate v2 upgrade workflow (see the "DefaultRoleTemplate v2 —
 * Diff / Review / Apply Upgrade Phase" plan, section 5) - mirrors the backend
 * DTOs under Core/DTOs/Capabilities/GrantGroupTemplateUpgradeDtos.cs 1:1.
 * `hasUpgrade` is independent of `isCustomized` - drift never suppresses
 * discovery of a newer template version.
 */
export interface GrantGroupTemplateUpgradeStatusDto {
  grantGroupId: string;
  templateKey: string;
  currentTemplateVersion: number;
  latestTemplateVersion: number;
  hasUpgrade: boolean;
  isCustomized: boolean;
}

export interface CapabilityDiffEntryDto {
  capabilityKey: string;
  /** Null when the capability doesn't exist on that side (added/removed entries) — backend does not track
   * per-capability version numbers for this diff in this phase (no CapabilityDefinition version changes yet). */
  currentScope: CapabilitySelectedScope | null;
  targetScope: CapabilitySelectedScope | null;
}

export type RawGrantSource = 'Capability' | 'TemplateCompatibility' | 'ManualAdvanced';

export interface RawGrantChangeDto {
  grantKey: string;
  source: RawGrantSource;
}

export type ConflictResolution = 'PreserveCurrent' | 'UseTemplate';

export interface ConflictDto {
  capabilityKey: string;
  baseScope: CapabilitySelectedScope;
  currentScope: CapabilitySelectedScope;
  targetScope: CapabilitySelectedScope;
  defaultResolution: ConflictResolution;
}

/** GET .../{id}/template-upgrade-diff?targetVersion= - read-only, never
 * mutates. `stateToken` must be echoed back unchanged on Preview/Apply so the
 * backend can detect concurrent drift (Part K). */
export interface GrantGroupTemplateDiffDto {
  currentTemplate: { key: string; version: number };
  targetTemplate: { key: string; version: number };
  addedCapabilities: CapabilityDiffEntryDto[];
  removedCapabilities: CapabilityDiffEntryDto[];
  changedCapabilities: CapabilityDiffEntryDto[];
  rawGrantsAdded: RawGrantChangeDto[];
  rawGrantsRemoved: RawGrantChangeDto[];
  rawGrantsUnchanged: RawGrantChangeDto[];
  conflicts: ConflictDto[];
  stateToken: string;
}

/** Body for POST .../template-upgrade/preview and .../template-upgrade/apply.
 * `resolutions` only needs entries for capabilities actually present in
 * `GrantGroupTemplateDiffDto.conflicts` - the backend rejects an incomplete
 * set with GRANT_GROUP_UPGRADE_CONFLICT_RESOLUTION_REQUIRED, independent of
 * any frontend gating (defense in depth, Part strict-gating decision). */
export interface GrantGroupTemplateUpgradePlanRequest {
  targetTemplateVersion: number;
  resolutions: Array<{ capabilityKey: string; resolution: ConflictResolution }>;
  stateToken: string;
}

/** Response of POST .../template-upgrade/preview - a dry-run of Apply with no
 * DB writes. The dialog only ever renders this server-computed shape; it
 * never recomputes raw grants itself (capability-materialization stays
 * backend-only, see capability-materialization.ts's own doc). */
export interface GrantGroupTemplateUpgradePlanDto {
  /** Backend's GrantGroupCapabilitySelectionDto — note: unlike
   * DefaultRoleTemplateCapabilityDto, it has no capabilityDefinitionId. */
  resultingCapabilitySelections: Array<{ capabilityKey: string; capabilityVersion: number; selectedScope: CapabilitySelectedScope }>;
  preservedManualGrantKeys: string[];
  resultingTemplateCompatibilityGrants: string[];
  rawGrantsAdded: RawGrantChangeDto[];
  rawGrantsRemoved: RawGrantChangeDto[];
  /** Just the capability keys of resolved conflicts, not full ConflictDto objects. */
  conflictsResolved: string[];
  stateToken: string;
}
