import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-admin-schedule',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.ADMIN.SCHEDULE" icon="pi-calendar" />`,
})
export class ScheduleComponent {}
