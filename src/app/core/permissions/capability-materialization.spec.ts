import { CapabilityDefinitionDto, GrantGroupTemplateMatchDto } from '../models/capability.model';
import {
  legalScopesFor,
  materializeCapability,
  reconstructCapabilitySelections,
  reconstructGrantProvenance,
} from './capability-materialization';

function capability(overrides: Partial<CapabilityDefinitionDto>): CapabilityDefinitionDto {
  return {
    id: 'id',
    key: 'test.capability',
    version: 1,
    categoryKey: 'test',
    scopeModel: 'None',
    sensitivity: 'Normal',
    isActive: true,
    deprecatedAt: null,
    grants: [],
    ...overrides,
  };
}

describe('legalScopesFor', () => {
  // Part T 1-4: the exact option set per ScopeModel.
  it('None: [None, On]', () => {
    expect(legalScopesFor('None')).toEqual(['None', 'On']);
  });
  it('ViewManage: [None, View, Manage]', () => {
    expect(legalScopesFor('ViewManage')).toEqual(['None', 'View', 'Manage']);
  });
  it('OwnAll: [None, Own, All]', () => {
    expect(legalScopesFor('OwnAll')).toEqual(['None', 'Own', 'All']);
  });
  it('ViewOwnAll: [None, View, Own, All]', () => {
    expect(legalScopesFor('ViewOwnAll')).toEqual(['None', 'View', 'Own', 'All']);
  });
});

describe('materializeCapability', () => {
  it('None model: On activates PrimaryNoScope only', () => {
    const cap = capability({ scopeModel: 'None', grants: [{ grantKey: 'x.manage', role: 'PrimaryNoScope' }] });
    expect(materializeCapability(cap.scopeModel, 'On', cap.grants)).toEqual(new Set(['x.manage']));
    expect(materializeCapability(cap.scopeModel, 'None', cap.grants)).toEqual(new Set());
  });

  it('ViewManage model: View activates PrimaryViewOnly; Manage activates both', () => {
    const grants = [
      { grantKey: 'x.view', role: 'PrimaryViewOnly' as const },
      { grantKey: 'x.manage', role: 'PrimaryManage' as const },
    ];
    expect(materializeCapability('ViewManage', 'View', grants)).toEqual(new Set(['x.view']));
    expect(materializeCapability('ViewManage', 'Manage', grants)).toEqual(new Set(['x.view', 'x.manage']));
    expect(materializeCapability('ViewManage', 'None', grants)).toEqual(new Set());
  });

  it('OwnAll model: Own activates PrimaryOwn only, All activates PrimaryAll only - never both', () => {
    const grants = [
      { grantKey: 'x.own', role: 'PrimaryOwn' as const },
      { grantKey: 'x.all', role: 'PrimaryAll' as const },
    ];
    expect(materializeCapability('OwnAll', 'Own', grants)).toEqual(new Set(['x.own']));
    expect(materializeCapability('OwnAll', 'All', grants)).toEqual(new Set(['x.all']));
  });

  it('ViewOwnAll model: Own includes View+Own (never All); All includes View+All (never Own)', () => {
    const grants = [
      { grantKey: 'x.view', role: 'PrimaryViewOnly' as const },
      { grantKey: 'x.own', role: 'PrimaryOwn' as const },
      { grantKey: 'x.all', role: 'PrimaryAll' as const },
    ];
    expect(materializeCapability('ViewOwnAll', 'View', grants)).toEqual(new Set(['x.view']));
    expect(materializeCapability('ViewOwnAll', 'Own', grants)).toEqual(new Set(['x.view', 'x.own']));
    expect(materializeCapability('ViewOwnAll', 'All', grants)).toEqual(new Set(['x.view', 'x.all']));
  });

  it('MandatorySupporting rows are included whenever selectedScope is not None', () => {
    const grants = [
      { grantKey: 'x.manage', role: 'PrimaryManage' as const },
      { grantKey: 'x.view', role: 'PrimaryViewOnly' as const },
      { grantKey: 'x.supporting', role: 'MandatorySupporting' as const },
    ];
    expect(materializeCapability('ViewManage', 'View', grants)).toEqual(new Set(['x.view', 'x.supporting']));
    expect(materializeCapability('ViewManage', 'None', grants)).toEqual(new Set());
  });
});

describe('reconstructCapabilitySelections', () => {
  const viewManageGrants = [
    { grantKey: 'x.view', role: 'PrimaryViewOnly' as const },
    { grantKey: 'x.manage', role: 'PrimaryManage' as const },
  ];
  const cap = capability({ key: 'x.manage', scopeModel: 'ViewManage', grants: viewManageGrants });

  it('no active raw grants -> None with empty claimed set', () => {
    const [result] = reconstructCapabilitySelections([cap], new Set(['unrelated.key']));
    expect(result.selectedScope).toBe('None');
    expect(result.claimedGrantKeys.size).toBe(0);
  });

  it('exact match against a legal scope -> that scope, claiming exactly its grants', () => {
    const [result] = reconstructCapabilitySelections([cap], new Set(['x.view']));
    expect(result.selectedScope).toBe('View');
    expect(result.claimedGrantKeys).toEqual(new Set(['x.view']));
  });

  it('Manage scope claims both grants', () => {
    const [result] = reconstructCapabilitySelections([cap], new Set(['x.view', 'x.manage']));
    expect(result.selectedScope).toBe('Manage');
    expect(result.claimedGrantKeys).toEqual(new Set(['x.view', 'x.manage']));
  });

  it('a drifted/ambiguous active subset (matches no legal scope exactly) is reported unmatched, not guessed', () => {
    // x.manage present WITHOUT x.view - not a legal ViewManage combination.
    const [result] = reconstructCapabilitySelections([cap], new Set(['x.manage']));
    expect(result.selectedScope).toBeNull();
    expect(result.claimedGrantKeys.size).toBe(0);
  });

  it('OwnAll: both Own and All raw grants present simultaneously is unmatched (mutually exclusive by design)', () => {
    const ownAllCap = capability({
      key: 'y.manage',
      scopeModel: 'OwnAll',
      grants: [
        { grantKey: 'y.own', role: 'PrimaryOwn' },
        { grantKey: 'y.all', role: 'PrimaryAll' },
      ],
    });
    const [result] = reconstructCapabilitySelections([ownAllCap], new Set(['y.own', 'y.all']));
    expect(result.selectedScope).toBeNull();
  });
});

describe('reconstructGrantProvenance', () => {
  const viewManageCap = capability({
    key: 'x.manage',
    categoryKey: 'test',
    scopeModel: 'ViewManage',
    grants: [
      { grantKey: 'x.view', role: 'PrimaryViewOnly' },
      { grantKey: 'x.manage', role: 'PrimaryManage' },
    ],
  });

  it('capability-derived grants are tagged source: capability with their capability key + scope (Part T 11 basis)', () => {
    const recon = reconstructGrantProvenance([viewManageCap], ['x.view', 'x.manage'], null);
    const viewProv = recon.provenance.find((p) => p.grantKey === 'x.view')!;
    expect(viewProv.source).toBe('capability');
    expect(viewProv.capabilityKey).toBe('x.manage');
    expect(viewProv.selectedScope).toBe('Manage');
    // Derived grants are never in the manually-editable grant pool (Part K/T11).
    expect(recon.manualGrantKeys.has('x.view')).toBe(false);
    expect(recon.manualGrantKeys.has('x.manage')).toBe(false);
  });

  it('a raw grant not explained by any capability is manual/unclaimed and CAN be represented as such (Part T 12)', () => {
    const recon = reconstructGrantProvenance([viewManageCap], ['legacy.unclaimed.key'], null);
    const prov = recon.provenance.find((p) => p.grantKey === 'legacy.unclaimed.key')!;
    expect(prov.source).toBe('manual');
    expect(recon.manualGrantKeys.has('legacy.unclaimed.key')).toBe(true);
  });

  it('a present-but-ambiguous capability grant is reported manual, never silently re-claimed or dropped (Part T 13 basis)', () => {
    // x.manage present without x.view - not a legal ViewManage combination for viewManageCap.
    const recon = reconstructGrantProvenance([viewManageCap], ['x.manage'], null);
    const prov = recon.provenance.find((p) => p.grantKey === 'x.manage')!;
    expect(prov.source).toBe('manual');
  });

  it('drifted/custom group (no snapshot metadata) preserves every raw grant and is flagged customized (Part T 14)', () => {
    const recon = reconstructGrantProvenance([viewManageCap], ['x.view', 'some.unknown.key'], null);
    expect(recon.isCustomized).toBe(true);
    expect(recon.provenance.map((p) => p.grantKey).sort()).toEqual(['some.unknown.key', 'x.view']);
  });

  it('trusts a backend snapshot over local reconstruction when hasSnapshotMetadata is true', () => {
    const templateMatch: GrantGroupTemplateMatchDto = {
      grantGroupId: 'g1',
      hasSnapshotMetadata: true,
      sourceTemplateKey: 'trener',
      sourceTemplateVersion: 1,
      snapshots: [
        {
          capabilityDefinitionId: viewManageCap.id,
          capabilityKey: viewManageCap.key,
          capabilityVersion: 1,
          selectedScope: 'View',
          sourceTemplateKey: 'trener',
          sourceTemplateVersion: 1,
          appliedAt: '2026-01-01T00:00:00Z',
        },
      ],
      templateGrants: [{ grantKey: 'compat.extra', sourceTemplateKey: 'trener', sourceTemplateVersion: 1, appliedAt: '2026-01-01T00:00:00Z' }],
    };
    const recon = reconstructGrantProvenance([viewManageCap], ['x.view', 'compat.extra'], templateMatch);
    expect(recon.isCustomized).toBe(false);
    expect(recon.provenance.find((p) => p.grantKey === 'x.view')!.source).toBe('capability');
    expect(recon.provenance.find((p) => p.grantKey === 'compat.extra')!.source).toBe('template');
  });

  it('products.manage and stock.manage reconstruct as fully independent capabilities (Part T 9/10)', () => {
    const productsCap = capability({
      key: 'products.manage',
      categoryKey: 'products',
      scopeModel: 'ViewManage',
      grants: [
        { grantKey: 'products.view', role: 'PrimaryViewOnly' },
        { grantKey: 'products.manage', role: 'PrimaryManage' },
      ],
    });
    const stockCap = capability({
      key: 'stock.manage',
      categoryKey: 'products',
      scopeModel: 'ViewManage',
      grants: [
        { grantKey: 'stock.view', role: 'PrimaryViewOnly' },
        { grantKey: 'stock.manage', role: 'PrimaryManage' },
      ],
    });
    const [productsResult, stockResult] = reconstructCapabilitySelections(
      [productsCap, stockCap],
      new Set(['products.view', 'products.manage']),
    );
    expect(productsResult.selectedScope).toBe('Manage');
    expect(stockResult.selectedScope).toBe('None');
  });
});
