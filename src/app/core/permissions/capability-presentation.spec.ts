import { CapabilityDefinitionDto } from '../models/capability.model';
import {
  capabilityDescriptionKey,
  capabilityLabelKey,
  categoryLabelKey,
  compareCategoryKeys,
  fallbackLabelFromKey,
  groupByCategory,
  resolveOrFallback,
  scopeOptionLabelKey,
  sensitivityLabelKey,
} from './capability-presentation';

function capability(key: string, categoryKey: string, overrides: Partial<CapabilityDefinitionDto> = {}): CapabilityDefinitionDto {
  return {
    id: key,
    key,
    version: 1,
    categoryKey,
    scopeModel: 'ViewManage',
    sensitivity: 'Normal',
    isActive: true,
    deprecatedAt: null,
    grants: [],
    ...overrides,
  };
}

describe('capability i18n key derivation (Part T 6/7)', () => {
  it('derives a stable label/description key from the capability key', () => {
    expect(capabilityLabelKey('schedule.appointments.manage')).toBe('PERMISSIONS.CAPABILITIES.schedule.appointments.manage.LABEL');
    expect(capabilityDescriptionKey('schedule.appointments.manage')).toBe(
      'PERMISSIONS.CAPABILITIES.schedule.appointments.manage.DESCRIPTION',
    );
  });

  it('derives a stable category label key from CategoryKey', () => {
    expect(categoryLabelKey('catalog')).toBe('PERMISSIONS.CATEGORIES.catalog');
  });

  it('derives a stable sensitivity label key', () => {
    expect(sensitivityLabelKey('HighRisk')).toBe('PERMISSIONS.SENSITIVITY.HighRisk');
  });
});

describe('scopeOptionLabelKey', () => {
  it('None model uses OFF/ON copy, not the generic NO_ACCESS copy', () => {
    expect(scopeOptionLabelKey('None', 'None')).toBe('PERMISSIONS.SCOPE_CONTROL.OFF');
    expect(scopeOptionLabelKey('None', 'On')).toBe('PERMISSIONS.SCOPE_CONTROL.ON');
  });

  it('every other model uses the generic NO_ACCESS copy for None', () => {
    expect(scopeOptionLabelKey('ViewManage', 'None')).toBe('PERMISSIONS.SCOPE_CONTROL.NO_ACCESS');
    expect(scopeOptionLabelKey('OwnAll', 'None')).toBe('PERMISSIONS.SCOPE_CONTROL.NO_ACCESS');
    expect(scopeOptionLabelKey('ViewOwnAll', 'None')).toBe('PERMISSIONS.SCOPE_CONTROL.NO_ACCESS');
  });
});

describe('compareCategoryKeys', () => {
  it('orders known categories per the fixed presentation order', () => {
    expect(compareCategoryKeys('schedule', 'organization')).toBeLessThan(0);
    expect(compareCategoryKeys('roster', 'schedule')).toBeGreaterThan(0);
  });

  it('an unknown future category sorts after every known one (Part T 19)', () => {
    expect(compareCategoryKeys('brand-new-category', 'organization')).toBeGreaterThan(0);
    expect(compareCategoryKeys('organization', 'brand-new-category')).toBeLessThan(0);
  });
});

describe('groupByCategory', () => {
  it('renders products.manage and stock.manage as two separate rows within the same category (Part T 9/10)', () => {
    const groups = groupByCategory([capability('products.manage', 'products'), capability('stock.manage', 'products')]);
    expect(groups.length).toBe(1);
    expect(groups[0].categoryKey).toBe('products');
    expect(groups[0].capabilities.map((c) => c.key)).toEqual(['products.manage', 'stock.manage']);
  });

  it('groups are emitted in CATEGORY_ORDER regardless of input order', () => {
    const groups = groupByCategory([capability('a', 'organization'), capability('b', 'schedule')]);
    expect(groups.map((g) => g.categoryKey)).toEqual(['schedule', 'organization']);
  });

  it('does not crash on an unrecognized future categoryKey (Part T 19)', () => {
    const groups = groupByCategory([capability('a', 'brand-new-category'), capability('b', 'schedule')]);
    expect(groups.map((g) => g.categoryKey)).toEqual(['schedule', 'brand-new-category']);
  });
});

describe('fallbackLabelFromKey / resolveOrFallback (Part T 19 - unknown capability tolerance)', () => {
  it('derives a readable fallback from an unknown key', () => {
    expect(fallbackLabelFromKey('inventory.warehouses.manage')).toBe('warehouses manage');
  });

  it('resolveOrFallback returns the real translation when present', () => {
    const fakeTranslate = { instant: (key: string) => (key === 'FOUND.KEY' ? 'Stvarni prijevod' : key) } as never;
    expect(resolveOrFallback(fakeTranslate, 'FOUND.KEY', 'found.key')).toBe('Stvarni prijevod');
  });

  it('resolveOrFallback falls back to a readable string when the translation is missing, never throwing or rendering the raw i18n key', () => {
    const fakeTranslate = { instant: (key: string) => key } as never;
    const result = resolveOrFallback(fakeTranslate, 'PERMISSIONS.CAPABILITIES.brand.new.capability.LABEL', 'brand.new.capability');
    expect(result).toBe('new capability');
    expect(result).not.toContain('PERMISSIONS.CAPABILITIES');
  });
});
