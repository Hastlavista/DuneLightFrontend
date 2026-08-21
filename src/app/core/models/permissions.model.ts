/** One grant key from the static catalog - GET /api/grants (Owner-only). Grants
 * are defined in backend code, never created/edited/deleted from the UI - this
 * screen only lets an Owner pick a subset of them into a GrantGroup. */
export interface GrantDto {
  key: string;
  module: string;
  description: string;
}

/** GET /api/permissions/grant-groups (Owner-only) and the items of its flat
 * list (not paged). `assignedUserCount` is informative only - DELETE 409s
 * (REFERENCED_CANNOT_DELETE) if it's non-zero, the backend is the real guard. */
export interface GrantGroupDto {
  id: string;
  name: string;
  grants: string[];
  assignedUserCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Body for both POST and PUT /api/permissions/grant-groups - identical shape.
 * `grants` may be empty (a group with no ovlasti is allowed), but every key
 * must exist in the Grants catalog (validated server-side). */
export interface GrantGroupUpsertRequest {
  name: string;
  grants: string[];
}

/** Body for PUT /api/permissions/grant-groups/assignments/{userId} - replaces
 * the user's ENTIRE GrantGroup set, not an add. Every employee needs at least
 * one (except the Owner, who bypasses grants entirely and is never assigned
 * one), enforced by the employee form, not this request shape itself. */
export interface AssignUserGrantGroupsRequest {
  grantGroupIds: string[];
}

/** GET /api/permissions/roles (Owner-only) and the items of its flat list. Pure
 * business-facing tag (e.g. "Trener") - does NOT affect authorization, unlike
 * GrantGroupDto. */
export interface RoleDto {
  id: string;
  name: string;
  createdAt: string | null;
}

/** Body for both POST and PUT /api/permissions/roles - identical shape. */
export interface RoleUpsertRequest {
  name: string;
}

/** Body for PUT /api/permissions/roles/assignments/{userId} - replaces the
 * user's entire Role set (optional, may be empty). */
export interface AssignUserRolesRequest {
  roleIds: string[];
}
