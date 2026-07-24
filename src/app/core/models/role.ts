/**
 * Role values exactly as the backend sends/accepts them (login response, employee
 * creation, role changes...). Use these everywhere in logic - guards, comparisons,
 * request bodies. Never use a display label for a comparison or a request.
 */
export type UserRole = 'Admin' | 'Member' | 'Reception';

/** Translation key for the on-screen label of each role. Resolve via the `translate` pipe. */
const ROLE_TRANSLATION_KEYS: Record<UserRole, string> = {
  Admin: 'ROLES.ADMIN',
  Member: 'ROLES.MEMBER',
  Reception: 'ROLES.RECEPTION',
};

export function roleTranslationKey(role: UserRole): string {
  return ROLE_TRANSLATION_KEYS[role];
}

/** All role values, in a sensible display order - for building Select options
 * (role filter, login role picker, role-change dialog). */
export const USER_ROLES: UserRole[] = ['Admin', 'Member', 'Reception'];
