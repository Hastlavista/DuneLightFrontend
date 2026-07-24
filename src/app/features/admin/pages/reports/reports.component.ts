import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-admin-reports',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.ADMIN.REPORTS" icon="pi-chart-line" />`,
})
export class ReportsComponent {}
