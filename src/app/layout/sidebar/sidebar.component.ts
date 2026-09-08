import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BrandingService, resolveBrandingAssetUrl } from '../../core/services/branding.service';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';
import { ADMIN_NAV_GROUPS, NavGroup, TRAINER_NAV_GROUPS } from '../nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly brandingService = inject(BrandingService);

  readonly section = input.required<'admin' | 'trainer'>();
  readonly navigated = output<void>();

  readonly navGroups = computed<NavGroup[]>(() => {
    const groups = this.section() === 'admin' ? ADMIN_NAV_GROUPS : TRAINER_NAV_GROUPS;
    const isOwner = this.currentEmployeeService.isOwner();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.ownerOnly && !isOwner) {
            return false;
          }
          return !item.requiredGrants || this.currentEmployeeService.hasAnyGrant(item.requiredGrants);
        }),
      }))
      .filter((group) => group.items.length > 0);
  });
  readonly basePath = computed(() => (this.section() === 'admin' ? '/admin' : '/app'));

  readonly logoUrl = computed(() => resolveBrandingAssetUrl(this.brandingService.branding()?.logo));

  onNavigate(): void {
    this.navigated.emit();
  }
}
