import { ACTION_POLICIES } from './action-policies';
import { PAGE_POLICIES } from './page-policies';
import { evaluatePermissionPolicy } from './permission-policy.model';

/**
 * FAZA 1 Part P/Q - the specific policy split the role editor's report
 * verdict F depends on: role ASSIGNMENT (employees.role.manage, a plain
 * grant) must stay reachable by a non-Owner holding that grant, while role
 * DEFINITION (PAGE_POLICIES.permissions, ownerOnly) must stay Owner-only
 * regardless of any grant. Both PAGE_POLICIES and ACTION_POLICIES remain
 * raw-grant based throughout - neither reads capability metadata (Part T 18).
 */
describe('role assignment vs. role definition policy split', () => {
  it('a non-Owner holding employees.role.manage passes the role-assignment action policy', () => {
    expect(
      evaluatePermissionPolicy(ACTION_POLICIES['employees.role.manage'], {
        isOwner: false,
        grants: ['employees.role.manage'],
      }),
    ).toBe(true);
  });

  it('a non-Owner without employees.role.manage fails the role-assignment action policy', () => {
    expect(evaluatePermissionPolicy(ACTION_POLICIES['employees.role.manage'], { isOwner: false, grants: [] })).toBe(false);
  });

  it('a non-Owner holding employees.role.manage is STILL denied the Owner-only role-definition page', () => {
    expect(
      evaluatePermissionPolicy(PAGE_POLICIES.permissions, { isOwner: false, grants: ['employees.role.manage'] }),
    ).toBe(false);
  });

  it('the Owner passes both regardless of grants', () => {
    expect(evaluatePermissionPolicy(ACTION_POLICIES['employees.role.manage'], { isOwner: true, grants: [] })).toBe(true);
    expect(evaluatePermissionPolicy(PAGE_POLICIES.permissions, { isOwner: true, grants: [] })).toBe(true);
  });
});
