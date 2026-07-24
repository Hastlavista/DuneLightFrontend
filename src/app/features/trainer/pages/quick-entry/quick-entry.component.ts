import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-trainer-quick-entry',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.TRAINER.QUICK_ENTRY" icon="pi-bolt" />`,
})
export class QuickEntryComponent {}
