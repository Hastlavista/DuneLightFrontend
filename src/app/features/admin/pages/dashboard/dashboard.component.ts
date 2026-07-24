import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-admin-dashboard',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.ADMIN.DASHBOARD" icon="pi-home" />`,
})
export class DashboardComponent {}
