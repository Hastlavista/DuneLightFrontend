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

/** GET /api/permissions/capabilities and GET /api/permissions/capabilities/{key} (Owner-only). */
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

/** GET /api/permissions/role-templates and GET /api/permissions/role-templates/{key} (Owner-only). */
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

/** GET /api/permissions/grant-groups/{id}/template-match (Owner-only).
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
