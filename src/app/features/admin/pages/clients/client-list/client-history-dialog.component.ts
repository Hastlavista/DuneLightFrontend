import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { finalize, forkJoin } from 'rxjs';
import {
  AppointmentDto,
  appointmentStatusTranslationKey,
  paymentMethodTranslationKey,
} from '../../../../../core/models/appointment.model';
import { coverageTypeTranslationKey } from '../../../../../core/models/group-attendance.model';
import {
  ClientPackageDto,
  ClientPackageServiceEntryDto,
  clientPackageStatusTranslationKey,
} from '../../../../../core/models/client-package.model';
import { ClientDto, ClientHistorySummaryDto } from '../../../../../core/models/client.model';
import { ClientGroupMembershipDto, dayOfWeekShortTranslationKey } from '../../../../../core/models/group.model';
import { AppointmentsService } from '../../../../../core/services/appointments.service';
import { ClientGroupsService } from '../../../../../core/services/client-groups.service';
import { ClientPackagesService } from '../../../../../core/services/client-packages.service';
import { ClientsService } from '../../../../../core/services/clients.service';

type HistoryTab = 'all' | 'training' | 'cancelled' | 'packages';

@Component({
  selector: 'app-client-history-dialog',
  imports: [Dialog, Button, TranslatePipe],
  templateUrl: './client-history-dialog.component.html',
  styleUrl: './client-history-dialog.component.scss',
})
export class ClientHistoryDialogComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly clientGroupsService = inject(ClientGroupsService);

  readonly visible = model(false);
  readonly client = input<ClientDto | null>(null);
  readonly loading = signal(false);
  readonly activeTab = signal<HistoryTab>('all');
  readonly summary = signal<ClientHistorySummaryDto | null>(null);
  readonly appointments = signal<AppointmentDto[]>([]);
  readonly packages = signal<ClientPackageDto[]>([]);
  readonly groups = signal<ClientGroupMembershipDto[]>([]);
  readonly appointmentStatusTranslationKey = appointmentStatusTranslationKey;
  readonly paymentMethodTranslationKey = paymentMethodTranslationKey;
  readonly coverageTypeTranslationKey = coverageTypeTranslationKey;
  readonly clientPackageStatusTranslationKey = clientPackageStatusTranslationKey;
  readonly dayOfWeekShortTranslationKey = dayOfWeekShortTranslationKey;

  readonly completedHours = computed(() => this.appointments()
    .filter((item) => item.status === 'Completed')
    .reduce((total, item) => total + item.durationMinutes, 0) / 60);
  readonly filteredAppointments = computed(() => {
    const tab = this.activeTab();
    if (tab === 'training') return this.appointments().filter((item) => item.status === 'Completed' || item.status === 'Scheduled');
    if (tab === 'cancelled') return this.appointments().filter((item) => item.status === 'Cancelled' || item.status === 'NoShow');
    return this.appointments();
  });

  constructor() {
    effect(() => {
      const client = this.client();
      if (this.visible() && client) {
        this.activeTab.set('all');
        this.load(client.id);
      } else if (!this.visible()) {
        this.clear();
      }
    });
  }

  selectTab(tab: HistoryTab): void {
    this.activeTab.set(tab);
  }

  close(): void {
    this.visible.set(false);
  }

  clientName(): string {
    const client = this.client();
    return client ? `${client.firstName} ${client.lastName}` : '';
  }

  clientMeta(): string {
    const client = this.client();
    if (!client) return '';
    return `Broj člana ${client.memberNumber}${client.homeCompanyName ? ` · ${client.homeCompanyName}` : ''}${client.homeTrainerName ? ` · matični trener ${client.homeTrainerName}` : ''}`;
  }

  initials(): string {
    const client = this.client();
    return client ? `${client.firstName[0] ?? ''}${client.lastName[0] ?? ''}`.toUpperCase() : '';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Nema zapisa';
    return new Intl.DateTimeFormat('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  }

  monthLabel(value: string): string {
    return new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric' }).format(new Date(value)).toUpperCase();
  }

  timeRange(item: AppointmentDto): string {
    const start = new Date(item.startsAt);
    const end = new Date(start.getTime() + item.durationMinutes * 60_000);
    const time = (date: Date) => `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    return `${time(start)} - ${time(end)}`;
  }

  packageUsage(packageItem: ClientPackageDto): string {
    if (packageItem.entryMode === 'SharedPool') {
      return packageItem.totalEntryCount === null ? 'Neograničen paket' : `${packageItem.remainingSharedEntries ?? 0} / ${packageItem.totalEntryCount} preostalo`;
    }
    const total = packageItem.serviceEntries.reduce((sum, item) => sum + (item.totalEntries ?? 0), 0);
    const remaining = packageItem.serviceEntries.reduce((sum, item) => sum + (item.remainingEntries ?? 0), 0);
    return total ? `${remaining} / ${total} preostalo` : 'Neograničen paket';
  }

  serviceEntryUsage(entry: ClientPackageServiceEntryDto): string {
    return entry.remainingEntries === null ? 'Neograničeno' : `${entry.remainingEntries} / ${entry.totalEntries}`;
  }

  priceLabel(price: number): string {
    return `${new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)} €`;
  }

  slotTimeLabel(startTime: string): string {
    return startTime.slice(0, 5);
  }

  clientNamesLabel(item: AppointmentDto): string {
    return item.clients.map((client) => client.clientName).join(', ');
  }

  private load(clientId: string): void {
    this.loading.set(true);
    forkJoin({
      summary: this.clientsService.getHistorySummary(clientId),
      appointments: this.appointmentsService.getByClient(clientId, { page: 1, pageSize: 100 }),
      packages: this.clientPackagesService.getForClient(clientId),
      groups: this.clientGroupsService.getForClient(clientId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ summary, appointments, packages, groups }) => {
        this.summary.set(summary);
        this.appointments.set(appointments.items);
        this.packages.set(packages);
        this.groups.set(groups);
      });
  }

  private clear(): void {
    this.summary.set(null);
    this.appointments.set([]);
    this.packages.set([]);
    this.groups.set([]);
  }
}
