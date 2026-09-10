import { Component, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { AppointmentDto } from '../../../../../core/models/appointment.model';
import { AppointmentsService } from '../../../../../core/services/appointments.service';

const DEFAULT_PAGE_SIZE = 20;

/**
 * "Povijest" tab on the employee profile page (edit mode only, see
 * EmployeeFormComponent) - GET /api/appointments/by-employee/{employeeId},
 * individual AND group termini in one chronological paged table, newest
 * first. Server-side filtered to Status=Completed only, unlike
 * ClientAppointmentsTabComponent's by-client history (which shows every
 * status) - so there's no status column here, every row is by definition
 * "odrađeno".
 */
@Component({
  selector: 'app-employee-history-tab',
  imports: [TableModule, Tag, TranslatePipe],
  templateUrl: './employee-history-tab.component.html',
  styleUrl: './employee-history-tab.component.scss',
})
export class EmployeeHistoryTabComponent {
  private readonly appointmentsService = inject(AppointmentsService);

  readonly employeeId = input.required<string>();

  readonly items = signal<AppointmentDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.rows.set(rows);
    this.fetchAppointments(first, rows);
  }

  /** "23.07.2026. 17:00" - hrDate has no time component, so this combines it
   * with a manual HH:mm, same approach as ClientAppointmentsTabComponent's
   * dateTimeLabel/AppointmentDetailDialog's timeRangeLabel. */
  dateTimeLabel(appt: AppointmentDto): string {
    const date = new Date(appt.startsAt);
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    return `${this.formatDate(date)} ${time}`;
  }

  clientNamesLabel(appt: AppointmentDto): string {
    return appt.clients.map((client) => client.clientName).join(', ');
  }

  private formatDate(date: Date): string {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}.`;
  }

  private fetchAppointments(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.appointmentsService
      .getByEmployee(this.employeeId(), { page, pageSize: rows })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
