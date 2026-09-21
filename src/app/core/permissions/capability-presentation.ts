import { TranslateService } from '@ngx-translate/core';
import { CapabilityDefinitionDto, CapabilityScopeModel, CapabilitySelectedScope, CapabilitySensitivity } from '../models/capability.model';

/**
 * FAZA 1 Parts E/H/S - the frontend owns ALL capability/category/sensitivity
 * copy. Backend metadata is language-neutral (key/categoryKey only) - these
 * helpers derive stable i18n keys from it, matching the translation entries
 * added under PERMISSIONS.CAPABILITIES / PERMISSIONS.CATEGORIES /
 * PERMISSIONS.SENSITIVITY in hr.json.
 *
 * Backend may add a brand-new capability/category key this frontend has no
 * translation for yet (Part S) - every resolver here falls back to a safe,
 * readable string instead of ever throwing or rendering a raw i18n key.
 */

/** Presentation-only order for known categories - NOT authorization
 * semantics, purely how the role editor groups capability rows. A category
 * key not listed here (future backend addition) sorts after all known ones,
 * alphabetically among themselves. */
const CATEGORY_ORDER: readonly string[] = [
  'schedule',
  'roster',
  'clients',
  'groups',
  'checkout',
  'catalog',
  'employees',
  'products',
  'commissions',
  'operations',
  'organization',
];

export interface CapabilityCategoryGroup {
  categoryKey: string;
  capabilities: CapabilityDefinitionDto[];
}

/** Groups a flat capability catalog by CategoryKey, in CATEGORY_ORDER (Part
 * E). Every capability renders as its own row within its category, generic
 * over `key` - this is what guarantees products.manage/stock.manage (or any
 * other pair) always show as separate rows without special-casing either key
 * (Part Products/Stock split, Part S forward-compatibility). */
export function groupByCategory(capabilities: readonly CapabilityDefinitionDto[]): CapabilityCategoryGroup[] {
  const byCategory = new Map<string, CapabilityDefinitionDto[]>();
  for (const capability of capabilities) {
    const list = byCategory.get(capability.categoryKey) ?? [];
    list.push(capability);
    byCategory.set(capability.categoryKey, list);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => compareCategoryKeys(a, b))
    .map(([categoryKey, list]) => ({ categoryKey, capabilities: list }));
}

export function compareCategoryKeys(a: string, b: string): number {
  const ai = CATEGORY_ORDER.indexOf(a);
  const bi = CATEGORY_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) {
    return ai - bi;
  }
  if (ai !== -1) {
    return -1;
  }
  if (bi !== -1) {
    return 1;
  }
  return a.localeCompare(b);
}

export function capabilityLabelKey(capabilityKey: string): string {
  return `PERMISSIONS.CAPABILITIES.${capabilityKey}.LABEL`;
}

export function capabilityDescriptionKey(capabilityKey: string): string {
  return `PERMISSIONS.CAPABILITIES.${capabilityKey}.DESCRIPTION`;
}

export function categoryLabelKey(categoryKey: string): string {
  return `PERMISSIONS.CATEGORIES.${categoryKey}`;
}

export function sensitivityLabelKey(sensitivity: CapabilitySensitivity): string {
  return `PERMISSIONS.SENSITIVITY.${sensitivity}`;
}

/** Part F - the same CapabilitySelectedScope reads differently depending on
 * its ScopeModel context ('None' means "Isključeno" on a None-model
 * capability, but "Nema pristupa" everywhere else) - see
 * CAPABILITY_SCOPE_OPTIONS for the exact per-model option sets this backs. */
export function scopeOptionLabelKey(scopeModel: CapabilityScopeModel, scope: CapabilitySelectedScope): string {
  if (scopeModel === 'None') {
    return scope === 'On' ? 'PERMISSIONS.SCOPE_CONTROL.ON' : 'PERMISSIONS.SCOPE_CONTROL.OFF';
  }
  switch (scope) {
    case 'None':
      return 'PERMISSIONS.SCOPE_CONTROL.NO_ACCESS';
    case 'View':
      return 'PERMISSIONS.SCOPE_CONTROL.VIEW';
    case 'Manage':
      return 'PERMISSIONS.SCOPE_CONTROL.MANAGE';
    case 'Own':
      return 'PERMISSIONS.SCOPE_CONTROL.OWN';
    case 'All':
      return 'PERMISSIONS.SCOPE_CONTROL.ALL';
    default:
      return 'PERMISSIONS.SCOPE_CONTROL.NO_ACCESS';
  }
}

/** Human-readable fallback for a capability/category key with no translation
 * entry (Part S) - e.g. "schedule.appointments.manage" -> "appointments
 * manage" (last two dot-segments, hyphens/dots turned into spaces). Never
 * used for a known key; only as a last resort so an unrecognized future
 * backend capability still renders something legible instead of a raw i18n
 * key like "PERMISSIONS.CAPABILITIES.foo.bar.LABEL". */
export function fallbackLabelFromKey(key: string): string {
  const segments = key.split('.');
  const tail = segments.slice(-2);
  return tail.join(' ').replace(/[-.]/g, ' ');
}

/** Resolves a translation key via ngx-translate, falling back to a readable
 * derivation of `key` (or the generic UNKNOWN_CAPABILITY copy) when the
 * translation is missing - ngx-translate's default MissingTranslationHandler
 * returns the key itself unchanged, which is how a miss is detected here. */
export function resolveOrFallback(translate: TranslateService, translationKey: string, fallbackSourceKey: string): string {
  const resolved = translate.instant(translationKey);
  if (resolved && resolved !== translationKey) {
    return resolved;
  }
  return fallbackLabelFromKey(fallbackSourceKey);
}
