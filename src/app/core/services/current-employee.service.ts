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
import { ACTION_POLICIES, ActionKey } from '../permissions/action-policies';
import { PAGE_POLICIES, PageKey } from '../permissions/page-policies';
import { evaluatePermissionPolicy, PermissionPolicy } from '../permissions/permission-policy.model';
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
  /** false = an authenticated user with no Employee record yet - in practice
   * only ever the organization's founder, right after Register and before
   * completing their own profile (see CompleteEmployeeProfileCtaComponent,
   * the sole consumer that treats this as "show the CTA"). Residual IsOwner
   * Removal - there is no Owner flag any more; this is the real underlying
   * business condition the old isOwner()-based check was standing in for. */
  readonly hasProfile = computed(() => this.employeeState() !== null);

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
   * anywhere the caller doesn't want to force a redundant re-fetch (route
   * guards such as grantGuard may run before ShellComponent's constructor
   * gets a chance to call load() itself). */
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

  /** Same OR logic as the backend's [RequireGrant]/GrantContext.HasAny -
   * Grant-only Tenant Authorization Refactor, no Owner bypass here any more
   * (see PermissionPolicy's doc). Mirrors what the matching endpoint would
   * actually allow, so it's safe to use for "should I show this button/menu
   * item" decisions - the backend still enforces the real check either way. */
  hasGrant(key: string): boolean {
    return this.employeeState()?.grants.includes(key) ?? false;
  }

  hasAnyGrant(keys: readonly string[]): boolean {
    const grants = this.employeeState()?.grants;
    return grants ? keys.some((key) => grants.includes(key)) : false;
  }

  /** Action-level (button/field) grant check - looks the key up in the
   * centralized ACTION_POLICIES catalog instead of taking raw grant keys, so
   * the grant a UI action checks can never drift from what its target
   * endpoint's [RequireGrant] actually enforces (see action-policies.ts).
   * Use for "should I show this button" (*ngIf) or "should this field be
   * editable" ([disabled]) decisions - PAGE_POLICIES/canPage() already
   * covers whether the user can reach the page at all. */
  can(action: ActionKey): boolean {
    return this.evaluate(ACTION_POLICIES[action]);
  }

  /** Page-level navigation check - looks the key up in the centralized
   * PAGE_POLICIES catalog (see page-policies.ts). Consumed by BOTH
   * grantGuard (blocks direct-URL navigation) and SidebarComponent (hides
   * the nav item), so the two can never drift apart. */
  canPage(page: PageKey): boolean {
    return this.evaluate(PAGE_POLICIES[page]);
  }

  /** Central policy evaluator (see evaluatePermissionPolicy's own doc for the
   * full anyOf/allOf semantics - no Owner bypass, Grant-only Tenant
   * Authorization Refactor). can()/canPage() are thin catalog lookups over
   * this; a guard or component with a genuine one-off policy (not worth
   * adding to either catalog) may also call this directly. */
  evaluate(policy: PermissionPolicy): boolean {
    return evaluatePermissionPolicy(policy, { grants: this.employeeState()?.grants ?? [] });
  }
}
