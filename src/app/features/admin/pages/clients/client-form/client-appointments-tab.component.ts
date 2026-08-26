import { Component, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import {
  AppointmentDto,
  PaymentMethod,
  appointmentStatusSeverity,
  appointmentStatusTranslationKey,
  paymentMethodTranslationKey,
} from '../../../../../core/models/appointment.model';
import { coverageTypeTranslationKey } from '../../../../../core/models/group-attendance.model';
import { ClientGroupMembershipDto, dayOfWeekShortTranslationKey } from '../../../../../core/models/group.model';
import { AppointmentsService } from '../../../../../core/services/appointments.service';
import { ClientGroupsService } from '../../../../../core/services/client-groups.service';
import { EurCurrencyPipe } from '../../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';

const DEFAULT_PAGE_SIZE = 20;

/**
 * "Termini" tab on the client detail page (edit mode only, see
 * ClientFormComponent) - two independent sections:
 * - "Moje grupe": GET /api/clients/{clientId}/groups, a flat array (not
 *   paged), same convention as ClientPackagesTabComponent's packages read.
 * - "Povijest termina": GET /api/appointments/by-client/{clientId}, individual
 *   AND group termini in one chronological paged table (newest first). A
 *   group row is only ever present once this client has a recorded
 *   attendance/absence on it - see AppointmentDto.clientAttendance - there are
 *   no "empty" group rows.
 */
@Component({
  selector: 'app-client-appointments-tab',
  imports: [TableModule, Tag, TranslatePipe, EurCurrencyPipe, HrDatePipe, StatusTagComponent],
  templateUrl: './client-appointments-tab.component.html',
  styleUrl: './client-appointments-tab.component.scss',
})
export class ClientAppointmentsTabComponent {
  private readonly clientGroupsService = inject(ClientGroupsService);
  private readonly appointmentsService = inject(AppointmentsService);

  readonly clientId = input.required<string>();

  readonly groups = signal<ClientGroupMembershipDto[]>([]);
  readonly groupsLoading = signal(false);

  readonly items = signal<AppointmentDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);

  readonly appointmentStatusTranslationKey = appointmentStatusTranslationKey;
  readonly appointmentStatusSeverity = appointmentStatusSeverity;
  readonly coverageTypeTranslationKey = coverageTypeTranslationKey;
  readonly paymentMethodTranslationKey = paymentMethodTranslationKey;
  readonly dayOfWeekShortTranslationKey = dayOfWeekShortTranslationKey;

  constructor() {
    effect(() => this.fetchGroups(this.clientId()));
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.rows.set(rows);
    this.fetchAppointments(first, rows);
  }

  /** "17:00" from a TimeSpan string ("HH:mm:ss") - see GroupSlotDto.startTime. */
  slotTimeLabel(startTime: string): string {
    return startTime.slice(0, 5);
  }

  /** "23.07.2026. 17:00" - hrDate has no time component, so this combines it
   * with a manual HH:mm, same approach as AppointmentDetailDialog's timeRangeLabel. */
  dateTimeLabel(appt: AppointmentDto): string {
    const date = new Date(appt.startsAt);
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    return `${this.formatDate(date)} ${time}`;
  }

  clientNamesLabel(appt: AppointmentDto): string {
    return appt.clients.map((client) => client.clientName).join(', ');
  }

  paymentLabel(paymentMethod: PaymentMethod | undefined): string | null {
    return paymentMethod ? paymentMethodTranslationKey(paymentMethod) : null;
  }

  private formatDate(date: Date): string {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}.`;
  }

  private fetchGroups(clientId: string): void {
    this.groupsLoading.set(true);
    this.clientGroupsService
      .getForClient(clientId)
      .pipe(finalize(() => this.groupsLoading.set(false)))
      .subscribe((groups) => this.groups.set(groups));
  }

  private fetchAppointments(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.appointmentsService
      .getByClient(this.clientId(), { page, pageSize: rows })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
