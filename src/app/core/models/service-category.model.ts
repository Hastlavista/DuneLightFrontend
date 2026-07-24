/** Execution mode values exactly as the backend sends/accepts them. Use these
 * everywhere in logic - never a display label. */
export type ServiceExecutionMode = 'Individual' | 'Group';

const EXECUTION_MODE_TRANSLATION_KEYS: Record<ServiceExecutionMode, string> = {
  Individual: 'CATALOG.CATEGORIES.EXECUTION_MODE.INDIVIDUAL',
  Group: 'CATALOG.CATEGORIES.EXECUTION_MODE.GROUP',
};

export function executionModeTranslationKey(mode: ServiceExecutionMode): string {
  return EXECUTION_MODE_TRANSLATION_KEYS[mode];
}

export const EXECUTION_MODES: ServiceExecutionMode[] = ['Individual', 'Group'];

/** GET /api/catalog/service-categories/{id} and the items of its paged list. */
export interface ServiceCategoryDto {
  id: string;
  name: string;
  executionMode: ServiceExecutionMode;
  colorHex: string | null;
  requiresClient: boolean;
  countsTowardRevenue: boolean;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Body for both POST and PUT /api/catalog/service-categories - identical shape.
 * requiresClient/countsTowardRevenue are never optional, always send an explicit
 * boolean. `isActive` is never sent, it has its own activate/deactivate endpoints. */
export interface ServiceCategoryUpsertRequest {
  name: string;
  executionMode: ServiceExecutionMode;
  colorHex: string | null;
  requiresClient: boolean;
  countsTowardRevenue: boolean;
  description: string | null;
  sortOrder: number;
}
