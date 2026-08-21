/** Execution mode values exactly as the backend sends/accepts them. Use these
 * everywhere in logic - never a display label. */
export type ServiceExecutionMode = 'Individual' | 'Group';

const EXECUTION_MODE_TRANSLATION_KEYS: Record<ServiceExecutionMode, string> = {
  Individual: 'CATALOG.SERVICES.EXECUTION_MODE.INDIVIDUAL',
  Group: 'CATALOG.SERVICES.EXECUTION_MODE.GROUP',
};

export function executionModeTranslationKey(mode: ServiceExecutionMode): string {
  return EXECUTION_MODE_TRANSLATION_KEYS[mode];
}

export const EXECUTION_MODES: ServiceExecutionMode[] = ['Individual', 'Group'];

/** GET /api/catalog/services/{id} and the items of its paged list. */
export interface ServiceDto {
  id: string;
  name: string;
  executionMode: ServiceExecutionMode;
  colorHex: string | null;
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
 * is never sent, it has its own activate/deactivate endpoints. */
export interface ServiceUpsertRequest {
  name: string;
  executionMode: ServiceExecutionMode;
  colorHex: string | null;
  defaultDurationMinutes: number;
  defaultPrice: number;
  description: string | null;
  sortOrder: number;
}
