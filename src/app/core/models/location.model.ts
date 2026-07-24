/** GET /api/catalog/locations/{id} and the items of its paged list. */
export interface LocationDto {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  colorHex: string | null;
  isActive: boolean;
  note: string | null;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Body for both POST /api/catalog/locations and PUT /api/catalog/locations/{id} -
 * the two requests are identical; `isActive` is never sent, it has its own
 * activate/deactivate endpoints. */
export interface LocationUpsertRequest {
  name: string;
  address: string | null;
  phone: string | null;
  colorHex: string | null;
  note: string | null;
  sortOrder: number;
}

/** Minimal shape the global location switcher (topbar) needs. */
export interface StudioLocation {
  id: string;
  name: string;
}

export function toStudioLocation(dto: LocationDto): StudioLocation {
  return { id: dto.id, name: dto.name };
}
