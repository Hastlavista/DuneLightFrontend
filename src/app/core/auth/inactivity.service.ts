import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentEmployeeService } from '../services/current-employee.service';
import { AuthService } from './auth.service';

/** Auto-lock timeout for shared-device fast user switching - a single,
 * easily-tunable constant. */
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart'] as const;

/**
 * Tracks app-wide user activity and, after INACTIVITY_TIMEOUT_MS of silence,
 * opens the shared-device PIN overlay for PIN-enabled accounts. Accounts
 * without a PIN are logged out and sent to the normal login form instead.
 * Started/stopped from ShellComponent.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private readonly auth = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly router = inject(Router);

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  /** The session remains in memory while locked so the previous workspace can
   * stay safely obscured behind the PIN prompt instead of being torn down. */
  readonly locked = signal(false);
  private readonly onActivity = (): void => this.resetTimer();

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.locked.set(false);
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, this.onActivity, { passive: true });
    }
    this.resetTimer();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    for (const event of ACTIVITY_EVENTS) {
      document.removeEventListener(event, this.onActivity);
    }
    this.clearTimer();
  }

  unlock(): void {
    this.locked.set(false);
    this.start();
    this.resetTimer();
  }

  /** Opens the shared-device PIN chooser immediately. Unlike logout, the
   * workspace stays mounted behind the overlay until a user authenticates. */
  lockNow(): void {
    this.stop();
    this.locked.set(true);
  }

  private resetTimer(): void {
    this.clearTimer();
    this.timeoutId = setTimeout(() => this.onTimeout(), INACTIVITY_TIMEOUT_MS);
  }

  private clearTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private onTimeout(): void {
    // A PIN-capable account can keep its current workspace mounted and
    // unlock it quickly. A password-only account has no way through that
    // overlay, so end its session and show the regular login form instead.
    if (this.currentEmployeeService.employee()?.hasPinSet) {
      this.lockNow();
      return;
    }

    this.stop();
    this.auth.logout();
    this.currentEmployeeService.clear();
    this.router.navigate(['/login'], { queryParams: { mode: 'full' } });
  }
}
