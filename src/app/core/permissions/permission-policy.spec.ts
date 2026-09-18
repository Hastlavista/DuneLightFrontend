import { evaluatePermissionPolicy, meetsSupportingReads, PermissionPolicy } from './permission-policy.model';

const OWN_GRANT = 'appointments.write.own';
const ALL_GRANT = 'appointments.write.all';
const READ_A = 'catalog.services.view';
const READ_B = 'catalog.companies.view';

describe('evaluatePermissionPolicy', () => {
  it('anyOf: passes when at least one grant is present', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [OWN_GRANT] })).toBe(true);
  });

  it('anyOf: fails when none of the grants are present', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: ['unrelated.grant'] })).toBe(false);
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [] })).toBe(false);
  });

  it('allOf: passes only when every grant is present', () => {
    const policy: PermissionPolicy = { allOf: [READ_A, READ_B] };
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [READ_A, READ_B] })).toBe(true);
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [READ_A] })).toBe(false);
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [] })).toBe(false);
  });

  it('anyOf + allOf combined: both must be satisfied', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT], allOf: [READ_A] };
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [OWN_GRANT, READ_A] })).toBe(true);
    // anyOf satisfied, allOf missing.
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [OWN_GRANT] })).toBe(false);
    // allOf satisfied, anyOf missing.
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [READ_A] })).toBe(false);
  });

  it('ownerOnly: denies every non-owner regardless of grants', () => {
    const policy: PermissionPolicy = { ownerOnly: true };
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [OWN_GRANT, ALL_GRANT, READ_A, READ_B] })).toBe(false);
  });

  it('owner bypass: passes anyOf/allOf/ownerOnly policies with zero grants', () => {
    expect(evaluatePermissionPolicy({ anyOf: [OWN_GRANT] }, { isOwner: true, grants: [] })).toBe(true);
    expect(evaluatePermissionPolicy({ allOf: [READ_A, READ_B] }, { isOwner: true, grants: [] })).toBe(true);
    expect(evaluatePermissionPolicy({ ownerOnly: true }, { isOwner: true, grants: [] })).toBe(true);
  });

  it('a policy with no anyOf/allOf/ownerOnly denies by default (fail-closed)', () => {
    expect(evaluatePermissionPolicy({}, { isOwner: false, grants: [OWN_GRANT] })).toBe(false);
  });

  it('own-only user passes an own/all anyOf pair; all-only user passes it too', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [OWN_GRANT] })).toBe(true);
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [ALL_GRANT] })).toBe(true);
  });

  it('a no-grant user fails an own/all anyOf pair', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { isOwner: false, grants: [] })).toBe(false);
  });
});

describe('meetsSupportingReads', () => {
  it('passes when every supportingAllOf grant is present', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT], supportingAllOf: [READ_A, READ_B] };
    expect(meetsSupportingReads(policy, { isOwner: false, grants: [OWN_GRANT, READ_A, READ_B] })).toBe(true);
  });

  it('fails when a supportingAllOf grant is missing', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT], supportingAllOf: [READ_A, READ_B] };
    expect(meetsSupportingReads(policy, { isOwner: false, grants: [OWN_GRANT, READ_A] })).toBe(false);
  });

  it('trivially passes when supportingAllOf is not set', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT] };
    expect(meetsSupportingReads(policy, { isOwner: false, grants: [] })).toBe(true);
  });

  it('never gates the primary anyOf/allOf boolean - a missing supporting read does not fail evaluatePermissionPolicy', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT], supportingAllOf: [READ_A, READ_B] };
    const ctx = { isOwner: false, grants: [OWN_GRANT] };
    expect(evaluatePermissionPolicy(policy, ctx)).toBe(true);
    expect(meetsSupportingReads(policy, ctx)).toBe(false);
  });

  it('owner bypasses supportingAllOf too', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT], supportingAllOf: [READ_A, READ_B] };
    expect(meetsSupportingReads(policy, { isOwner: true, grants: [] })).toBe(true);
  });
});
