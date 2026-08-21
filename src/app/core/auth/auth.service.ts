import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  ChangePasswordRequest,
  ChangePinRequest,
  LoginRequest,
  PinLoginRequest,
  RegisterRequest,
} from '../models/auth.models';
import { UserRole } from '../models/role';

const STORAGE_KEY = 'dl_auth';
const LAST_SLUG_KEY = 'dl_last_org_slug';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authState = signal<AuthResponse | null>(this.readFromStorage());

  readonly currentUser = this.authState.asReadonly();
  readonly isLoggedIn = computed(() => this.authState() !== null);
  readonly currentRole = computed<UserRole | null>(() => this.authState()?.role ?? null);
  readonly token = computed(() => this.authState()?.token ?? null);

  constructor(private readonly http: HttpClient) {}

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/public/Auth/Login`, request)
      .pipe(
        tap((response) => {
          this.setSession(response);
          this.rememberOrganizationSlug(request.organizationSlug);
        }),
      );
  }

  /** POST /api/public/Auth/Register - creates the organization and its Owner
   * user, then logs them straight in (same AuthResponse shape as login(),
   * already carrying a valid token) - no separate login step needed
   * afterwards. `request` has no organizationSlug (the backend derives and
   * returns one), so it's remembered from the response instead of the request. */
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/public/Auth/Register`, request)
      .pipe(
        tap((response) => {
          this.setSession(response);
          this.rememberOrganizationSlug(response.organizationSlug);
        }),
      );
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/public/Auth/ChangePassword`, request);
  }

  /** POST /api/public/Auth/PinLogin - fast user switching on a shared device.
   * Always a fresh call to the backend (no cached tokens reused), same
   * session-setting behavior as login(). */
  pinLogin(request: PinLoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/public/Auth/PinLogin`, request)
      .pipe(
        tap((response) => {
          this.setSession(response);
          this.rememberOrganizationSlug(request.organizationSlug);
        }),
      );
  }

  changePin(request: ChangePinRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/public/Auth/ChangePin`, request);
  }

  logout(): void {
    this.authState.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  getRememberedOrganizationSlug(): string {
    return localStorage.getItem(LAST_SLUG_KEY) ?? '';
  }

  private rememberOrganizationSlug(slug: string): void {
    localStorage.setItem(LAST_SLUG_KEY, slug);
  }

  private setSession(response: AuthResponse): void {
    this.authState.set(response);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
  }

  private readFromStorage(): AuthResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
