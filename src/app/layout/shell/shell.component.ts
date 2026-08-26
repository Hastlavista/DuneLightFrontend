import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InactivityService } from '../../core/auth/inactivity.service';
import { KnownUsersService } from '../../core/auth/known-users.service';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';
import { LocationContextService } from '../../core/services/location-context.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly section = input.required<'admin' | 'trainer'>();

  readonly sidebarOpen = signal(false);

  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly pageTitleKey = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.deepestTitleKey()),
      startWith(null),
    ),
    { initialValue: null },
  );

  constructor(
    private readonly locationContextService: LocationContextService,
    private readonly currentEmployeeService: CurrentEmployeeService,
    private readonly authService: AuthService,
    private readonly knownUsersService: KnownUsersService,
    private readonly inactivityService: InactivityService,
  ) {
    this.locationContextService.loadLocations();
    // ensureLoaded(), not load() - a guard on this navigation (adminGuard/
    // ownerGuard) may have already triggered and awaited the fetch before
    // this component ever got constructed; avoid a redundant second call.
    this.currentEmployeeService.ensureLoaded().subscribe((employee) => {
      const user = this.authService.currentUser();
      if (employee && user) {
        // Keeps the device's "known users" chooser fresh on every session
        // start (full login or PIN login both land here) - see
        // KnownUsersService's doc comment. Only users with a PIN set belong
        // in the chooser (it exists to collect a PIN, which a user without
        // one can never provide); this also self-heals any user who got
        // added before this check existed, or who had their PIN removed
        // since - forget() is a no-op if they're not in the list.
        if (employee.hasPinSet) {
          this.knownUsersService.remember({
            email: user.email,
            organizationSlug: user.organizationSlug,
            firstName: employee.firstName,
            lastName: employee.lastName,
            colorHex: employee.colorHex,
          });
        } else {
          this.knownUsersService.forget(user.email, user.organizationSlug);
        }
      }
    });

    this.inactivityService.start();
    inject(DestroyRef).onDestroy(() => this.inactivityService.stop());
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private deepestTitleKey(): string | null {
    let route: ActivatedRoute | null = this.activatedRoute?.firstChild ?? null;
    while (route?.firstChild) {
      route = route.firstChild;
    }
    return (route?.snapshot?.data?.['titleKey'] as string | undefined) ?? null;
  }
}
