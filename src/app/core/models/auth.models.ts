import { UserRole } from './role';

export interface LoginRequest {
  organizationSlug: string;
  email: string;
  password: string;
}

/** Body for POST /api/public/Auth/Register - creates a brand new Organization
 * plus its Owner user in one call (see AuthService.Register on the backend).
 * No organizationSlug here - the backend derives one from organizationName
 * and returns it in the response. */
export interface RegisterRequest {
  organizationName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  apiKey: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  token: string;
  tokenExpiration: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Body for POST /api/public/Auth/PinLogin - fast user switching on a shared
 * device. Returns the same AuthResponse shape as Login, a fresh token every
 * time (no cached credentials involved). */
export interface PinLoginRequest {
  organizationSlug: string;
  email: string;
  pin: string;
}

/** Body for POST /api/public/Auth/ChangePin - [Authorize]'d, sets or replaces
 * the caller's own PIN. Requires the current password, not the current PIN,
 * as proof of identity (same convention as ChangePasswordRequest). */
export interface ChangePinRequest {
  currentPassword: string;
  newPin: string;
}
