import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-trainer-today',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.TRAINER.TODAY_ALL" icon="pi-calendar-clock" />`,
})
export class TodayComponent {}
