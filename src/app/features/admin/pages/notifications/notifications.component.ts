import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { ClientDto } from '../../../../core/models/client.model';
import { LogicalNotificationDto, LogicalNotificationStatus, LogicalNotificationType } from '../../../../core/models/logical-notification.model';
import { ClientsService } from '../../../../core/services/clients.service';
import { LogicalNotificationsService } from '../../../../core/services/logical-notifications.service';
import { HrDatePipe } from '../../../../shared/pipes/hr-date.pipe';
@Component({ selector: 'app-admin-notifications', imports: [FormsModule, Button, Select, Tag, HrDatePipe], templateUrl: './notifications.component.html', styleUrl: './notifications.component.scss' })
export class NotificationsComponent {
  private readonly api = inject(LogicalNotificationsService); private readonly clientsApi = inject(ClientsService);
  readonly clients = signal<ClientDto[]>([]); readonly items = signal<LogicalNotificationDto[]>([]); readonly total = signal(0); readonly loading = signal(false); selectedClientId = ''; page = 1; readonly pageSize = 20;
  constructor() { this.clientsApi.getPage({page:1,pageSize:200,isActive:true}).subscribe(result => this.clients.set(result.items)); }
  load(): void { if (!this.selectedClientId) { this.items.set([]); this.total.set(0); return; } this.loading.set(true); this.api.getForClient(this.selectedClientId, this.page, this.pageSize).pipe(finalize(() => this.loading.set(false))).subscribe({ next: result => { this.items.set(result.items); this.total.set(result.totalCount); }, error: () => { this.items.set([]); this.total.set(0); } }); }
  onClientChange(): void { this.page = 1; this.load(); } previous(): void { if (this.page > 1) { this.page--; this.load(); } } next(): void { if (this.page * this.pageSize < this.total()) { this.page++; this.load(); } }
  typeLabel(type: LogicalNotificationType): string { return ({ BookingCancelled: 'Otkazana rezervacija', BookingNoShow: 'Nedolazak', WaitlistPromoted: 'Promaknut s liste čekanja' })[type] ?? type; }
  severity(status: LogicalNotificationStatus): 'success' | 'secondary' { return status === 'Pending' ? 'success' : 'secondary'; }
}
