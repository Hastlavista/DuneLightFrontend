import { ACTION_POLICIES } from './action-policies';
import { PAGE_POLICIES } from './page-policies';
import { evaluatePermissionPolicy } from './permission-policy.model';

/**
 * Grant-only Tenant Authorization Refactor - the specific policy split the
 * role editor's report verdict F depends on: legacy UserRole ASSIGNMENT
 * (employees.role.manage, a plain grant) is a distinct authority from
 * GrantGroup/permission administration (PAGE_POLICIES.permissions -
 * permissions.view/permissions.manage). Neither implies the other, and there
 * is no Owner bypass any more - both PAGE_POLICIES and ACTION_POLICIES remain
 * raw-grant based throughout (Part T 18).
 */
describe('legacy role assignment vs. permission administration policy split', () => {
  it('a user holding employees.role.manage passes the role-assignment action policy', () => {
    expect(
      evaluatePermissionPolicy(ACTION_POLICIES['employees.role.manage'], {
        grants: ['employees.role.manage'],
      }),
    ).toBe(true);
  });

  it('a user without employees.role.manage fails the role-assignment action policy', () => {
    expect(evaluatePermissionPolicy(ACTION_POLICIES['employees.role.manage'], { grants: [] })).toBe(false);
  });

  it('a user holding only employees.role.manage is denied the permissions (GrantGroup administration) page', () => {
    expect(evaluatePermissionPolicy(PAGE_POLICIES.permissions, { grants: ['employees.role.manage'] })).toBe(false);
  });

  it('a user holding permissions.view or permissions.manage passes the permissions page regardless of employees.role.manage', () => {
    expect(evaluatePermissionPolicy(PAGE_POLICIES.permissions, { grants: ['permissions.view'] })).toBe(true);
    expect(evaluatePermissionPolicy(PAGE_POLICIES.permissions, { grants: ['permissions.manage'] })).toBe(true);
  });

  it('GrantGroup name has no bearing here - only the raw grant matters', () => {
    // The policy itself never references a GrantGroup name; this test documents that guarantee explicitly.
    expect(PAGE_POLICIES.permissions).not.toHaveProperty('groupName');
    expect(evaluatePermissionPolicy(PAGE_POLICIES.permissions, { grants: ['permissions.manage'] })).toBe(true);
  });
});
