import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { ClientDto } from '../../../../core/models/client.model';
import { LogicalNotificationDto, LogicalNotificationStatus } from '../../../../core/models/logical-notification.model';
import { ClientsService } from '../../../../core/services/clients.service';
import { LogicalNotificationsService } from '../../../../core/services/logical-notifications.service';
import { HrDatePipe } from '../../../../shared/pipes/hr-date.pipe';

const CLIENT_SEARCH_PAGE_SIZE = 10;

interface ClientSearchOption {
  clientId: string;
  name: string;
}

/** Client picker is a server-side search (same pattern as CheckoutEntryComponent),
 * not a fixed first page of clients. */
@Component({ selector: 'app-admin-notifications', imports: [FormsModule, TranslatePipe, AutoComplete, Button, Tag, HrDatePipe], templateUrl: './notifications.component.html', styleUrl: './notifications.component.scss' })
export class NotificationsComponent {
  private readonly api = inject(LogicalNotificationsService); private readonly clientsApi = inject(ClientsService);
  readonly clientResults = signal<ClientSearchOption[]>([]); readonly selectedClient = signal<ClientSearchOption | null>(null);
  readonly items = signal<LogicalNotificationDto[]>([]); readonly total = signal(0); readonly loading = signal(false); readonly failed = signal(false); page = 1; readonly pageSize = 20;
  // Latest-request-wins: a slower response for an older search/client must not replace the current one.
  private searchToken = 0; private loadToken = 0;
  onClientSearch(event: AutoCompleteCompleteEvent): void { const term = event.query.trim(); const token = ++this.searchToken; if (!term) { this.clientResults.set([]); return; } this.clientsApi.getPage({ page: 1, pageSize: CLIENT_SEARCH_PAGE_SIZE, search: term, isActive: true }, { suppressErrorToast: true }).subscribe(result => { if (token === this.searchToken) this.clientResults.set(result.items.map((client: ClientDto) => ({ clientId: client.id, name: `${client.firstName} ${client.lastName}` }))); }); }
  /** p-autoComplete emits the raw query string while typing - only a picked suggestion selects a client. */
  onSelectedClientChange(client: ClientSearchOption | string | null): void { if (!client || typeof client === 'string') { this.selectedClient.set(null); this.loadToken++; this.loading.set(false); this.failed.set(false); this.items.set([]); this.total.set(0); return; } this.selectedClient.set(client); this.page = 1; this.load(); }
  load(): void { const clientId = this.selectedClient()?.clientId; if (!clientId) { this.items.set([]); this.total.set(0); return; } const token = ++this.loadToken; this.loading.set(true); this.failed.set(false); this.api.getForClient(clientId, this.page, this.pageSize).pipe(finalize(() => { if (token === this.loadToken) this.loading.set(false); })).subscribe({ next: result => { if (token !== this.loadToken) return; this.items.set(result.items); this.total.set(result.totalCount); }, error: () => { if (token !== this.loadToken) return; this.items.set([]); this.total.set(0); this.failed.set(true); } }); }
  previous(): void { if (this.page > 1) { this.page--; this.load(); } } next(): void { if (this.page * this.pageSize < this.total()) { this.page++; this.load(); } }
  severity(status: LogicalNotificationStatus): 'success' | 'secondary' { return status === 'Pending' ? 'success' : 'secondary'; }
}
