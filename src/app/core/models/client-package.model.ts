import { PackageEntryMode, PackageValidityType } from './package.model';

/** Status values exactly as the backend sends them for a sold package. Use these
 * everywhere in logic - never a display label. */
export type ClientPackageStatus = 'Active' | 'Expired' | 'Depleted' | 'Cancelled';

const STATUS_TRANSLATION_KEYS: Record<ClientPackageStatus, string> = {
  Active: 'CLIENTS.PACKAGES.STATUS.ACTIVE',
  Expired: 'CLIENTS.PACKAGES.STATUS.EXPIRED',
  Depleted: 'CLIENTS.PACKAGES.STATUS.DEPLETED',
  Cancelled: 'CLIENTS.PACKAGES.STATUS.CANCELLED',
};

export function clientPackageStatusTranslationKey(status: ClientPackageStatus): string {
  return STATUS_TRANSLATION_KEYS[status];
}

const STATUS_SEVERITIES: Record<ClientPackageStatus, 'success' | 'warn' | 'danger' | 'secondary'> = {
  Active: 'success',
  Expired: 'secondary',
  Depleted: 'warn',
  Cancelled: 'danger',
};

export function clientPackageStatusSeverity(status: ClientPackageStatus): 'success' | 'warn' | 'danger' | 'secondary' {
  return STATUS_SEVERITIES[status];
}

/** One service's remaining entries inside a PerService sold package - irrelevant
 * under SharedPool (see ClientPackageDto.remainingSharedEntries instead).
 * `totalEntries`/`remainingEntries` are null for an unlimited per-service
 * allowance (mirrors SharedPool's totalEntryCount null = unlimited). */
export interface ClientPackageServiceEntryDto {
  serviceId: string;
  serviceName: string;
  totalEntries: number | null;
  remainingEntries: number | null;
}

/** GET /api/clients/{clientId}/packages/{id} and the items of its (flat, not
 * paged) list. Which of remainingSharedEntries/serviceEntries is meaningful
 * depends on entryMode - SharedPool uses remainingSharedEntries/totalEntryCount
 * (null totalEntryCount = unlimited), PerService uses serviceEntries. */
export interface ClientPackageDto {
  id: string;
  clientId: string;
  packageId: string;
  packageName: string;
  purchaseDate: string;
  paidPrice: number;
  entryMode: PackageEntryMode;
  totalEntryCount: number | null;
  remainingSharedEntries: number | null;
  validityType: PackageValidityType;
  expiryDate: string | null;
  status: ClientPackageStatus;
  serviceEntries: ClientPackageServiceEntryDto[];
  createdAt: string;
  createdBy?: string;
}

/** Body for POST /api/clients/{clientId}/packages. `purchaseDate` empty = now,
 * `paidPrice` empty = resolved from the price list by the backend. `companyId`
 * is only used server-side to suggest/resolve the price - it is not persisted
 * on the sold package. */
export interface ClientPackagePurchaseRequest {
  packageId: string;
  purchaseDate: string | null;
  paidPrice: number | null;
  companyId: string | null;
}

/** Remaining entries a given sold package grants for a specific service - null
 * means unlimited. SharedPool packages cover every service from one pool
 * (unlimited exactly when totalEntryCount is null, same check as
 * ClientPackagesTabComponent.sharedPoolLabel); PerService packages look up
 * their per-service entry, unlimited when its remainingEntries is null.
 * Shared between any screen that needs to label an eligible package - see
 * GET /api/clients/{clientId}/packages/eligible and EligiblePackageSelectComponent. */
export function remainingEntriesForService(pkg: ClientPackageDto, serviceId: string): number | null {
  if (pkg.entryMode === 'SharedPool') {
    return pkg.totalEntryCount == null ? null : pkg.remainingSharedEntries;
  }
  return pkg.serviceEntries.find((entry) => entry.serviceId === serviceId)?.remainingEntries ?? null;
}
