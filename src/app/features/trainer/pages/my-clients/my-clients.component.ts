import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';

@Component({
  selector: 'app-trainer-my-clients',
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder titleKey="NAV.TRAINER.MY_CLIENTS" icon="pi-users" />`,
})
export class MyClientsComponent {}
