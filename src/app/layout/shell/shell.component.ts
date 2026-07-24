import { Component, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
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
  ) {
    this.locationContextService.loadLocations();
    this.currentEmployeeService.load().subscribe();
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
