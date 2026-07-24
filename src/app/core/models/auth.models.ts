import { UserRole } from './role';

export interface LoginRequest {
  organizationSlug: string;
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
