import { Component } from '@angular/core';
import { ClientListComponent } from '../../../admin/pages/clients/client-list/client-list.component';

/**
 * "Moji klijenti" - a thin host for the same ClientListComponent admin's
 * Klijenti tab uses (see ClientsComponent), just with `mineFirst` set so the
 * logged-in trainer's own clients sort first - every trainer still sees every
 * client, per the Klijenti module contract. Admin-only actions (deactivate/
 * activate/delete/anonymize) are hidden by ClientListComponent itself based on
 * role, not anything this wrapper does.
 */
@Component({
  selector: 'app-trainer-my-clients',
  imports: [ClientListComponent],
  template: `<app-admin-client-list [mineFirst]="true" />`,
})
export class MyClientsComponent {}
