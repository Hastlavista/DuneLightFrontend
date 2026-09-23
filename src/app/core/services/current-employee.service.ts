import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { CurrentEmployee } from '../models/employee.model';
import { ACTION_POLICIES, ActionKey } from '../permissions/action-policies';
import { PAGE_POLICIES, PageKey } from '../permissions/page-policies';
import { evaluatePermissionPolicy, PermissionPolicy } from '../permissions/permission-policy.model';

@Injectable({ providedIn: 'root' })
export class CurrentEmployeeService {
  private readonly http = inject(HttpClient);

  private readonly employeeState = signal<CurrentEmployee | null>(null);
  private readonly loadedState = signal(false);

  readonly employee = this.employeeState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  /** false = an authenticated user with no Employee record yet - in practice
   * only ever the organization's founder, right after Register and before
   * completing their own profile (see CompleteEmployeeProfileCtaComponent,
   * the sole consumer that treats this as "show the CTA"). Authorization
   * belongs to the User regardless (see CurrentEmployee.grants' own doc) -
   * there is no Owner flag anywhere (Residual IsOwner Removal). */
  readonly hasProfile = computed(() => this.employeeState()?.hasProfile ?? false);

  // grantGuard (on a child route's own guard chain) and ShellComponent's
  // constructor can both call ensureLoaded() for the SAME navigation before
  // either's request resolves - loadedState() is still false for both at that
  // point, so without this, each would fire its own GET /api/employees/me.
  // Share the one in-flight request instead (same pattern as
  // CompanyContextService.loadCompanies()'s loadInFlight guard).
  private inFlight: Observable<CurrentEmployee | null> | null = null;

  load(): Observable<CurrentEmployee | null> {
    if (this.inFlight) {
      return this.inFlight;
    }
    const request$ = this.http
      .get<CurrentEmployee>(`${environment.apiUrl}/api/employees/me`, {
        context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true),
      })
      .pipe(
        tap((employee) => {
          this.employeeState.set(employee);
          this.loadedState.set(true);
        }),
        // GET /api/employees/me now always succeeds (200, HasProfile=false) for any
        // valid authenticated User, even one with no Employee profile yet (always the
        // organization's founder right after Register - see EmployeeService.GetMe and
        // CurrentEmployee's own doc). A deactivated/nonexistent User is already
        // rejected at the JWT layer (Startup.cs's OnTokenValidated), before this
        // request is even authenticated - so a failure reaching here is a genuine
        // transient error, never "no profile". Stay unloaded so the next
        // ensureLoaded() retries; never guess at logging the user out from here.
        catchError(() => of(null)),
        finalize(() => {
          this.inFlight = null;
        }),
        shareReplay(1),
      );
    this.inFlight = request$;
    return request$;
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
