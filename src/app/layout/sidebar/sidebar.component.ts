import { Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BrandingService, resolveBrandingAssetUrl } from '../../core/services/branding.service';
import { CurrentEmployeeService } from '../../core/services/current-employee.service';
import { NAV_GROUPS, NavGroup } from '../nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly brandingService = inject(BrandingService);

  readonly navigated = output<void>();

  readonly navGroups = computed<NavGroup[]>(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.pageKey || this.currentEmployeeService.canPage(item.pageKey)),
    })).filter((group) => group.items.length > 0);
  });
  readonly basePath = '/app';

  readonly logoUrl = computed(() => resolveBrandingAssetUrl(this.brandingService.branding()?.logo));

  onNavigate(): void {
    this.navigated.emit();
  }
}
