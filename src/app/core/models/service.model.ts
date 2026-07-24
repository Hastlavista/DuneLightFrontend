/** GET /api/catalog/services/{id} and the items of its paged list. Note there is
 * no executionMode here - derive it from the linked category (serviceCategoryId)
 * if needed, via the already-loaded category list. */
export interface ServiceDto {
  id: string;
  name: string;
  serviceCategoryId: string;
  serviceCategoryName: string;
  defaultDurationMinutes: number;
  defaultPrice: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Body for both POST and PUT /api/catalog/services - identical shape. `isActive`
 * is never sent, it has its own activate/deactivate endpoints. The backend
 * rejects a serviceCategoryId that points to an inactive category with
 * VALIDATION_ERROR - the category dropdown must only offer active categories. */
export interface ServiceUpsertRequest {
  name: string;
  serviceCategoryId: string;
  defaultDurationMinutes: number;
  defaultPrice: number;
  description: string | null;
  sortOrder: number;
}
