/** GET /api/employees/engagement-types/{id} and the items of its paged list. */
export interface EngagementTypeDto {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Body for both POST and PUT /api/employees/engagement-types - identical
 * shape; `isActive` is never sent, it has its own activate/deactivate
 * endpoints. */
export interface EngagementTypeUpsertRequest {
  name: string;
  sortOrder: number;
}
