import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { EffectivePriceListComponent } from './effective/effective-price-list.component';
import { PriceListItemsComponent } from './price-list-items/price-list-items.component';

/**
 * "Cjenik" tab (inside "Usluge i cjenik" - see ServicesComponent for the parent
 * shell). Two sub-tabs: raw CRUD over price list rows ("Stavke cjenika") vs. the
 * read-only resolved view for a given location+date ("Trenutni cjenik").
 */
@Component({
  selector: 'app-admin-pricing',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    PriceListItemsComponent,
    EffectivePriceListComponent,
  ],
  templateUrl: './pricing.component.html',
})
export class PricingComponent {}
