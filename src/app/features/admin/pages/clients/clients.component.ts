import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { BirthdaysComponent } from './birthdays/birthdays.component';
import { ClientListComponent } from './client-list/client-list.component';
import { ClientTagsComponent } from './client-tags/client-tags.component';

const DEFAULT_TAB = 'clients';

/**
 * "Klijenti" tab shell - same convention as EmployeesComponent. Oznake klijenata
 * is a small šifrarnik used only by the client form's tag multiselect, so it
 * lives as a second tab here rather than getting its own nav entry. Rođendani is
 * a read-only lookup over the same client data, added as a third tab rather than
 * a separate sidebar entry. Klijenti's create/edit form is a separate routed
 * page (see ClientFormComponent) and always navigates back to this default tab.
 */
@Component({
  selector: 'app-admin-clients',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, TranslatePipe, ClientListComponent, ClientTagsComponent, BirthdaysComponent],
  templateUrl: './clients.component.html',
})
export class ClientsComponent {
  private readonly route = inject(ActivatedRoute);

  readonly initialTab = this.route.snapshot.queryParamMap.get('tab') ?? DEFAULT_TAB;
}
