import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-trainer-my-shifts',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.TRAINER.MY_SHIFTS" icon="pi-clock" />`,
})
export class MyShiftsComponent {}
