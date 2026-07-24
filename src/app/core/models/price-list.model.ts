export type PriceListSubjectType = 'Service' | 'Package';

/** Where an effective/resolved price came from - see PriceListService.getEffective
 * and .resolve. Location-specific beats "all locations" beats the subject's
 * own default price. */
export type PriceSource = 'LocationSpecific' | 'AllLocations' | 'Default';

/** GET /api/catalog/price-list/{id} and the items of its paged list. Exactly one
 * of serviceId/packageId is populated (matching subjectType); the other is
 * omitted from the JSON, not null. locationId omitted/null = applies to all
 * locations (and locationName is then omitted too). */
export interface PriceListItemDto {
  id: string;
  subjectType: PriceListSubjectType;
  serviceId?: string;
  serviceName?: string;
  packageId?: string;
  packageName?: string;
  locationId?: string;
  locationName?: string;
  price: number;
  validFrom: string;
  validTo?: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Body for POST /api/catalog/price-list. Subject and location are only ever set
 * here - PUT (PriceListUpdateRequest) can't change them. */
export interface PriceListCreateRequest {
  subjectType: PriceListSubjectType;
  serviceId?: string;
  packageId?: string;
  locationId?: string;
  price: number;
  validFrom: string;
  validTo?: string;
}

/** Body for PUT /api/catalog/price-list/{id} - price and validity period only.
 * Subject/location are immutable after creation; the form disables those
 * fields in edit mode instead of sending them here. */
export interface PriceListUpdateRequest {
  price: number;
  validFrom: string;
  validTo?: string;
}

/** One row of GET /api/catalog/price-list/effective. */
export interface EffectivePriceRow {
  subjectType: PriceListSubjectType;
  subjectId: string;
  subjectName: string;
  price: number;
  source: PriceSource;
}

/** Response of GET /api/catalog/price-list/resolve. */
export interface ResolvePriceResult {
  subjectType: PriceListSubjectType;
  subjectId: string;
  locationId: string;
  date: string;
  price: number;
  source: PriceSource;
}

export function priceListSubjectName(item: PriceListItemDto): string {
  return item.subjectType === 'Service' ? (item.serviceName ?? '') : (item.packageName ?? '');
}
