/** Entry-mode values exactly as the backend sends/accepts them. SharedPool = the
 * package has one shared entry count (totalEntryCount); PerService = each linked
 * service has its own entry count and totalEntryCount is irrelevant. Use these
 * everywhere in logic - never a display label. */
export type PackageEntryMode = 'SharedPool' | 'PerService';

const ENTRY_MODE_TRANSLATION_KEYS: Record<PackageEntryMode, string> = {
  SharedPool: 'CATALOG.PACKAGES.ENTRY_MODE.SHARED_POOL',
  PerService: 'CATALOG.PACKAGES.ENTRY_MODE.PER_SERVICE',
};

export function entryModeTranslationKey(mode: PackageEntryMode): string {
  return ENTRY_MODE_TRANSLATION_KEYS[mode];
}

export const PACKAGE_ENTRY_MODES: PackageEntryMode[] = ['SharedPool', 'PerService'];

/** Validity-type values exactly as the backend sends/accepts them. */
export type PackageValidityType = 'DayCount' | 'EndOfMonth' | 'FixedDate';

const VALIDITY_TYPE_TRANSLATION_KEYS: Record<PackageValidityType, string> = {
  DayCount: 'CATALOG.PACKAGES.VALIDITY_TYPE.DAY_COUNT',
  EndOfMonth: 'CATALOG.PACKAGES.VALIDITY_TYPE.END_OF_MONTH',
  FixedDate: 'CATALOG.PACKAGES.VALIDITY_TYPE.FIXED_DATE',
};

export function validityTypeTranslationKey(type: PackageValidityType): string {
  return VALIDITY_TYPE_TRANSLATION_KEYS[type];
}

export const PACKAGE_VALIDITY_TYPES: PackageValidityType[] = ['DayCount', 'EndOfMonth', 'FixedDate'];

/** One linked service inside a package, as returned by GET. `entryCount` is only
 * meaningful under PerService - the server forces it to null under SharedPool. */
export interface PackageServiceLinkDto {
  serviceId: string;
  serviceName: string;
  entryCount: number | null;
}

/** GET /api/catalog/packages/{id} and the items of its paged list. */
export interface PackageDto {
  id: string;
  name: string;
  description: string | null;
  entryMode: PackageEntryMode;
  totalEntryCount: number | null;
  validityType: PackageValidityType;
  validityDays: number | null;
  validityFixedDate: string | null;
  defaultPrice: number;
  isActive: boolean;
  sortOrder: number;
  services: PackageServiceLinkDto[];
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** One linked service in a create/update request - no serviceName, unlike the
 * response. Send `entryCount` as null unless entryMode is PerService; the server
 * forces it to null under SharedPool regardless of what's sent. */
export interface PackageServiceLinkRequest {
  serviceId: string;
  entryCount: number | null;
}

/** Body for both POST and PUT /api/catalog/packages - identical shape, including
 * `services`: PUT does a full replace of the linked services, not a merge.
 * `isActive` is never sent, it has its own activate/deactivate endpoints. Whichever
 * of totalEntryCount/validityDays/validityFixedDate doesn't match entryMode/
 * validityType is irrelevant and should be sent as null - the server ignores it
 * either way. */
export interface PackageUpsertRequest {
  name: string;
  description: string | null;
  entryMode: PackageEntryMode;
  totalEntryCount: number | null;
  validityType: PackageValidityType;
  validityDays: number | null;
  validityFixedDate: string | null;
  defaultPrice: number;
  sortOrder: number;
  services: PackageServiceLinkRequest[];
}
