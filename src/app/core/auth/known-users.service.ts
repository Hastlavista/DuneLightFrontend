import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'dl_known_users';

/** Display-only data for a device's "known users" chooser - no tokens, just
 * enough to render a card and re-attempt PinLogin. Populated from
 * CurrentEmployee + AuthResponse once both are available (see
 * ShellComponent), never from the login/pin-login response alone since
 * neither carries firstName/lastName/colorHex by itself. */
export interface KnownDeviceUser {
  email: string;
  firstName: string;
  lastName: string;
  organizationSlug: string;
  colorHex: string | null;
}

/**
 * "Poznati korisnici na uređaju" - a pure frontend concept, the backend knows
 * nothing about devices. Kept in localStorage, refreshed on every successful
 * full login and PIN login so it stays accurate as names/colors change.
 */
@Injectable({ providedIn: 'root' })
export class KnownUsersService {
  private readonly usersState = signal<KnownDeviceUser[]>(this.readFromStorage());

  readonly users = this.usersState.asReadonly();

  forOrganization(organizationSlug: string): KnownDeviceUser[] {
    return this.usersState().filter((user) => user.organizationSlug === organizationSlug);
  }

  /** Upserts by email+organizationSlug, most-recently-used first. */
  remember(user: KnownDeviceUser): void {
    const others = this.usersState().filter(
      (existing) => !(existing.email === user.email && existing.organizationSlug === user.organizationSlug),
    );
    this.persist([user, ...others]);
  }

  forget(email: string, organizationSlug: string): void {
    this.persist(
      this.usersState().filter((user) => !(user.email === email && user.organizationSlug === organizationSlug)),
    );
  }

  private persist(users: KnownDeviceUser[]): void {
    this.usersState.set(users);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  private readFromStorage(): KnownDeviceUser[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as KnownDeviceUser[]) : [];
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }
}
