import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { CategoriesComponent } from '../catalog/categories/categories.component';
import { PackagesComponent } from '../catalog/packages/packages.component';
import { PricingComponent } from '../catalog/pricing/pricing.component';
import { CatalogServicesComponent } from '../catalog/services/services.component';

const DEFAULT_TAB = 'categories';

/**
 * "Usluge i cjenik" tab shell. All four tabs (Kategorije, Usluge, Cjenik, Paketi)
 * are live. Since Paketi's create/edit form is a separate routed page rather than
 * a dialog, navigating back from it needs to land back on this tab - the `tab`
 * query param (read once here, since a route change always recreates this
 * component) carries that.
 */
@Component({
  selector: 'app-admin-services',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    CategoriesComponent,
    CatalogServicesComponent,
    PricingComponent,
    PackagesComponent,
  ],
  templateUrl: './services.component.html',
})
export class ServicesComponent {
  private readonly route = inject(ActivatedRoute);

  readonly initialTab = this.route.snapshot.queryParamMap.get('tab') ?? DEFAULT_TAB;
}
