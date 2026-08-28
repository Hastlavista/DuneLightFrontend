/** GET /api/catalog/companies/{id} and the items of its paged list (backend
 * route/entity is "Company" - kept named Location on the frontend since the
 * user-facing concept and screen stay "Lokacije"). */
export interface LocationDto {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  colorHex: string | null;
  /** ISO 3166-1 alpha-2 (e.g. "HR") - drives which holiday catalog "Generiraj
   * standardne praznike" resolves for this location, see CompanyHolidayDto. */
  country: string;
  isActive: boolean;
  note: string | null;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Body for both POST /api/catalog/companies and PUT /api/catalog/companies/{id} -
 * the two requests are identical; `isActive` is never sent, it has its own
 * activate/deactivate endpoints. */
export interface LocationUpsertRequest {
  name: string;
  address: string | null;
  phone: string | null;
  colorHex: string | null;
  country: string;
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
