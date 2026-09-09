import { Component } from '@angular/core';
import { PriceListItemsComponent } from './price-list-items/price-list-items.component';

/**
 * Unified Cjenik tab inside Usluge i cjenik. It combines the read-only effective
 * price view with editable price-list rows in a single, coherent workspace.
 */
@Component({
  selector: 'app-admin-pricing',
  imports: [PriceListItemsComponent],
  templateUrl: './pricing.component.html',
})
export class PricingComponent {}
