import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-admin-shifts',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.ADMIN.SHIFTS" icon="pi-clock" />`,
})
export class ShiftsComponent {}
