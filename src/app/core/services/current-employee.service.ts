import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { CurrentEmployee } from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class CurrentEmployeeService {
  private readonly employeeState = signal<CurrentEmployee | null>(null);
  private readonly loadedState = signal(false);

  readonly employee = this.employeeState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  /** false = Owner/Admin logged in without an Employee record yet (rare, e.g. right after Register). */
  readonly hasProfile = computed(() => this.employeeState() !== null);

  constructor(private readonly http: HttpClient) {}

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
        // On 404 (no Employee record) as well as any other error: the user stays
        // logged in, just without a trainer profile - the app doesn't crash.
        catchError(() => {
          this.employeeState.set(null);
          this.loadedState.set(true);
          return of(null);
        }),
      );
  }

  clear(): void {
    this.employeeState.set(null);
    this.loadedState.set(false);
  }
}
