import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-trainer-my-week',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.TRAINER.MY_WEEK" icon="pi-calendar" />`,
})
export class MyWeekComponent {}
