/** GET /api/clients/tags/{id} and the items of its paged list. */
export interface ClientTagDto {
  id: string;
  name: string;
  colorHex: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Body for both POST and PUT /api/clients/tags - identical shape. `isActive` is
 * never sent, it has its own activate/deactivate endpoints. */
export interface ClientTagUpsertRequest {
  name: string;
  colorHex: string | null;
  sortOrder: number;
}
