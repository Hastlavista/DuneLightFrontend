/** GET /api/catalog/companies/{id} and the items of its paged list. */
export interface CompanyDto {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  colorHex: string | null;
  /** ISO 3166-1 alpha-2 (e.g. "HR") - drives which holiday catalog "Generiraj
   * standardne praznike" resolves for this company, see CompanyHolidayDto. */
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
export interface CompanyUpsertRequest {
  name: string;
  address: string | null;
  phone: string | null;
  colorHex: string | null;
  country: string;
  note: string | null;
  sortOrder: number;
}

/** Company shape held by CompanyContextService: the topbar switcher plus
 * company dropdowns/color accents on the pages. `colorHex` is null for
 * companies known only from the viewer's own assignments. */
export interface StudioCompany {
  id: string;
  name: string;
  colorHex: string | null;
}

export function toStudioCompany(dto: CompanyDto): StudioCompany {
  return { id: dto.id, name: dto.name, colorHex: dto.colorHex };
}
