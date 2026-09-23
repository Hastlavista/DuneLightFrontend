import { evaluatePermissionPolicy, meetsSupportingReads, PermissionPolicy } from './permission-policy.model';

const OWN_GRANT = 'appointments.write.own';
const ALL_GRANT = 'appointments.write.all';
const READ_A = 'catalog.services.view';
const READ_B = 'catalog.companies.view';

describe('evaluatePermissionPolicy', () => {
  it('anyOf: passes when at least one grant is present', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { grants: [OWN_GRANT] })).toBe(true);
  });

  it('anyOf: fails when none of the grants are present', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { grants: ['unrelated.grant'] })).toBe(false);
    expect(evaluatePermissionPolicy(policy, { grants: [] })).toBe(false);
  });

  it('allOf: passes only when every grant is present', () => {
    const policy: PermissionPolicy = { allOf: [READ_A, READ_B] };
    expect(evaluatePermissionPolicy(policy, { grants: [READ_A, READ_B] })).toBe(true);
    expect(evaluatePermissionPolicy(policy, { grants: [READ_A] })).toBe(false);
    expect(evaluatePermissionPolicy(policy, { grants: [] })).toBe(false);
  });

  it('anyOf + allOf combined: both must be satisfied', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT], allOf: [READ_A] };
    expect(evaluatePermissionPolicy(policy, { grants: [OWN_GRANT, READ_A] })).toBe(true);
    // anyOf satisfied, allOf missing.
    expect(evaluatePermissionPolicy(policy, { grants: [OWN_GRANT] })).toBe(false);
    // allOf satisfied, anyOf missing.
    expect(evaluatePermissionPolicy(policy, { grants: [READ_A] })).toBe(false);
  });

  it('a policy with no anyOf/allOf denies by default (fail-closed)', () => {
    expect(evaluatePermissionPolicy({}, { grants: [OWN_GRANT] })).toBe(false);
  });

  it('own-only user passes an own/all anyOf pair; all-only user passes it too', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { grants: [OWN_GRANT] })).toBe(true);
    expect(evaluatePermissionPolicy(policy, { grants: [ALL_GRANT] })).toBe(true);
  });

  it('a no-grant user fails an own/all anyOf pair', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT, ALL_GRANT] };
    expect(evaluatePermissionPolicy(policy, { grants: [] })).toBe(false);
  });
});

describe('meetsSupportingReads', () => {
  it('passes when every supportingAllOf grant is present', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT], supportingAllOf: [READ_A, READ_B] };
    expect(meetsSupportingReads(policy, { grants: [OWN_GRANT, READ_A, READ_B] })).toBe(true);
  });

  it('fails when a supportingAllOf grant is missing', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT], supportingAllOf: [READ_A, READ_B] };
    expect(meetsSupportingReads(policy, { grants: [OWN_GRANT, READ_A] })).toBe(false);
  });

  it('trivially passes when supportingAllOf is not set', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT] };
    expect(meetsSupportingReads(policy, { grants: [] })).toBe(true);
  });

  it('never gates the primary anyOf/allOf boolean - a missing supporting read does not fail evaluatePermissionPolicy', () => {
    const policy: PermissionPolicy = { anyOf: [OWN_GRANT], supportingAllOf: [READ_A, READ_B] };
    const ctx = { grants: [OWN_GRANT] };
    expect(evaluatePermissionPolicy(policy, ctx)).toBe(true);
    expect(meetsSupportingReads(policy, ctx)).toBe(false);
  });
});
