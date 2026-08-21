import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { GrantGroupsComponent } from './grant-groups/grant-groups.component';
import { RolesComponent } from './roles/roles.component';

const DEFAULT_TAB = 'grant-groups';

/**
 * "Dozvole" tab shell (Owner-only, see ownerGuard on this route and its
 * children) - Grant Groups and Roles share one nav entry, same reasoning as
 * Zaposlenici's Vrste angažmana tab. GrantGroup's create/edit form is a
 * separate routed page (too much content for a modal, see
 * GrantGroupFormComponent) and always navigates back to this default tab.
 */
@Component({
  selector: 'app-admin-permissions',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, TranslatePipe, GrantGroupsComponent, RolesComponent],
  templateUrl: './permissions.component.html',
})
export class PermissionsComponent {
  private readonly route = inject(ActivatedRoute);

  readonly initialTab = this.route.snapshot.queryParamMap.get('tab') ?? DEFAULT_TAB;
}
