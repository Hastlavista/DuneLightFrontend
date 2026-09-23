import { Component, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { ProductsListComponent } from '../catalog/products/products-list.component';
import { StockPageComponent } from '../catalog/products/stock/stock-page.component';

const DEFAULT_TAB = 'products';

/**
 * "Proizvodi i zaliha" tab shell - same shape as ServicesComponent (see its
 * own doc): Product catalog CRUD (products.view/.manage) and Company-scoped
 * stock management (stock.view/.manage) are two different grants/screens but
 * share one nav entry, same convention as Usluge/Paketi/Cjenik.
 */
@Component({
  selector: 'app-admin-products',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, TranslatePipe, ProductsListComponent, StockPageComponent],
  templateUrl: './products.component.html',
})
export class ProductsComponent {
  private readonly route = inject(ActivatedRoute);

  readonly initialTab = this.route.snapshot.queryParamMap.get('tab') ?? DEFAULT_TAB;

  private readonly stock = viewChild(StockPageComponent);

  // Stock tab renders lazily; if it hasn't been opened yet it loads fresh data on first activation.
  onProductsChanged(): void {
    this.stock()?.refresh();
  }
}
