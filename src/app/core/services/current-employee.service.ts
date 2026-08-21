import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { CurrentEmployee } from '../models/employee.model';
import { resolveErrorMessage } from '../utils/error-translation.util';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class CurrentEmployeeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  private readonly employeeState = signal<CurrentEmployee | null>(null);
  private readonly loadedState = signal(false);

  readonly employee = this.employeeState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  /** false = Owner/Admin logged in without an Employee record yet (rare, e.g. right after Register). */
  readonly hasProfile = computed(() => this.employeeState() !== null);

  /** Authoritative once an Employee profile exists (EmployeeMeDto.isOwner). With
   * no profile at all, fall back to the legacy 'Admin' role claim - after the
   * grant-system migration every with-login-created employee is hardcoded to
   * UserRole.Member server-side (see EmployeeService.CreateWithLogin), so
   * 'Admin' is only ever set for the account Register creates (the Owner) -
   * making it a reliable stand-in until a profile-less Owner creates their own
   * Employee record. */
  readonly isOwner = computed(() => {
    const employee = this.employeeState();
    if (employee) {
      return employee.isOwner;
    }
    return this.loadedState() && this.auth.currentRole() === 'Admin';
  });

  load(): Observable<CurrentEmployee | null> {
    return this.http
      .get<CurrentEmployee>(`${environment.apiUrl}/api/employees/me`, {
        context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
      })
      .pipe(
        tap((employee) => {
          this.employeeState.set(employee);
          this.loadedState.set(true);
        }),
        // A 404 has two very different causes: (a) Admin/Owner who never got an
        // Employee record (fine, quietly stay logged in without a trainer
        // profile), or (b) Member/Reception whose Employee record was deleted
        // out from under an already-logged-in session (their token is still
        // "valid" but the account behind it is gone) - only (a) is expected for
        // Admin, so anything else ends the session instead of leaving the user
        // stuck looking at permanently empty trainer screens.
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404 && this.auth.currentRole() !== 'Admin') {
            this.auth.logout();
            this.notification.showError(resolveErrorMessage(this.translate, 'UNAUTHORIZED'));
            this.router.navigate(['/login']);
          }
          this.employeeState.set(null);
          this.loadedState.set(true);
          return of(null);
        }),
      );
  }

  /** Returns already-loaded state synchronously (as an Observable) if a load
   * already completed, otherwise triggers one - use this instead of load()
   * anywhere the caller doesn't want to force a redundant re-fetch (guards
   * that may run before ShellComponent's constructor gets a chance to call
   * load() itself - see admin.guard.ts/owner.guard.ts's own doc comments for
   * why that ordering matters here). */
  ensureLoaded(): Observable<CurrentEmployee | null> {
    if (this.loadedState()) {
      return of(this.employeeState());
    }
    return this.load();
  }

  clear(): void {
    this.employeeState.set(null);
    this.loadedState.set(false);
  }

  /** Same OR logic as the backend's [RequireGrant]/GrantContext.HasAny - the
   * Owner always passes regardless of the key(s) asked for. Mirrors what the
   * matching endpoint would actually allow, so it's safe to use for "should I
   * show this button/menu item" decisions - the backend still enforces the
   * real check on the request itself either way. */
  hasGrant(key: string): boolean {
    return this.isOwner() || (this.employeeState()?.grants.includes(key) ?? false);
  }

  hasAnyGrant(keys: string[]): boolean {
    if (this.isOwner()) {
      return true;
    }
    const grants = this.employeeState()?.grants;
    return grants ? keys.some((key) => grants.includes(key)) : false;
  }
}
