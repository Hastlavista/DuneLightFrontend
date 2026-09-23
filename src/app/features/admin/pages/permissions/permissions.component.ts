import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { GrantGroupsComponent } from './grant-groups/grant-groups.component';
import { RolesComponent } from './roles/roles.component';

const DEFAULT_TAB = 'grant-groups';

/**
 * "Dozvole" tab shell (gated on permissions.view/permissions.manage, see
 * grantGuard('permissions') on this route and its children - Grant-only
 * Tenant Authorization Refactor, no more Owner-only) - Grant Groups and Roles
 * share one nav entry, same reasoning as Zaposlenici's Vrste angažmana tab.
 * GrantGroup's create/edit form is a separate routed page (too much content
 * for a modal, see GrantGroupFormComponent) and always navigates back to this
 * default tab.
 *
 * Unlike before this refactor, the two tabs are no longer authorized
 * identically: GrantGroups is permissions.view/manage (this page's own
 * gate), but Roles (a business display-label concept, NOT permission
 * administration - see RolesController's doc) is employees.manage. A viewer
 * who reached this page via permissions.view/manage but lacks employees.view
 * would 403 on the Roles tab's own API calls, so it's hidden rather than
 * shown-then-broken.
 */
@Component({
  selector: 'app-admin-permissions',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, TranslatePipe, GrantGroupsComponent, RolesComponent],
  templateUrl: './permissions.component.html',
})
export class PermissionsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  readonly initialTab = this.route.snapshot.queryParamMap.get('tab') ?? DEFAULT_TAB;
  readonly canSeeRolesTab = computed(() => this.currentEmployeeService.hasAnyGrant(['employees.view', 'employees.manage']));
}
