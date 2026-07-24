import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-admin-finance',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.ADMIN.FINANCE" icon="pi-wallet" />`,
})
export class FinanceComponent {}
