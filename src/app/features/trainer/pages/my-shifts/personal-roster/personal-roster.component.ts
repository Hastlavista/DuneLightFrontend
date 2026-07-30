import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { EmployeeSummary } from '../../../../../core/models/employee.model';
import { PersonalRosterDto, RosterEntryDto } from '../../../../../core/models/roster.model';
import { NotificationService } from '../../../../../core/services/notification.service';
import { RosterEntriesService } from '../../../../../core/services/roster-entries.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../../../core/utils/date.util';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';

interface EmployeeSelectOption {
  label: string;
  value: string;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

/**
 * Ekran 3 - one employee's own entries over an adjustable date range (unlike
 * the team-monthly matrix, not locked to a calendar month). Delete is a real
 * delete here (unlike termini's cancel/no-show), matching
 * DELETE /roster/entries/{id}'s contract.
 *
 * `allowEmployeePicker` is a PAGE/ROUTE concern, not a role check - it must
 * NOT be bound to the logged-in user's real role. /app/my-shifts (trainer
 * section) always passes false: this tab is "Moj pregled", exclusively the
 * viewer's own data, even when the viewer is an Admin browsing there via the
 * trainer-view toggle (their role is still 'Admin', but the page must behave
 * the same for everyone on it). /admin/shifts always passes true. Getting
 * this wrong once already leaked an "pick any employee" dropdown onto the
 * trainer page for an Admin account - see MyShiftsComponent/ShiftsComponent's
 * hardcoded bindings, not a computed role check. */
@Component({
  selector: 'app-roster-personal',
  imports: [Button, Select, DatePicker, FormsModule, TranslatePipe, HrDatePipe],
  templateUrl: './personal-roster.component.html',
  styleUrl: './personal-roster.component.scss',
})
export class PersonalRosterComponent {
  private readonly rosterEntriesService = inject(RosterEntriesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly allowEmployeePicker = input(false);
  readonly currentEmployeeId = input<string | null>(null);
  readonly employees = input<EmployeeSummary[]>([]);

  readonly add = output<{ employeeId: string; date: Date }>();
  readonly edit = output<RosterEntryDto>();

  readonly selectedEmployeeId = signal<string | null>(null);
  readonly fromDate = signal<Date>(startOfCurrentMonth());
  readonly toDate = signal<Date>(endOfCurrentMonth());

  readonly data = signal<PersonalRosterDto | null>(null);
  readonly loading = signal(false);

  readonly employeeOptions = computed<EmployeeSelectOption[]>(() =>
    this.employees().map((employee) => ({ label: `${employee.firstName} ${employee.lastName}`, value: employee.id })),
  );

  /** Locked to the viewer's own id unless this page allows picking someone
   * else - and even then, defaults to "self" until they actively pick, since
   * "Moj pregled" is the primary path even on the admin page. */
  readonly effectiveEmployeeId = computed(() =>
    this.allowEmployeePicker() ? (this.selectedEmployeeId() ?? this.currentEmployeeId()) : this.currentEmployeeId(),
  );

  constructor() {
    effect(() => {
      // Re-run once the current employee resolves (Member) or once the admin
      // picks someone - both flip effectiveEmployeeId from null to a real id.
      const employeeId = this.effectiveEmployeeId();
      if (employeeId) {
        this.fetch(employeeId);
      }
    });
  }

  onEmployeeChange(value: string | null): void {
    this.selectedEmployeeId.set(value);
  }

  onFromDateChange(value: Date): void {
    this.fromDate.set(value);
  }

  onToDateChange(value: Date): void {
    this.toDate.set(value);
  }

  applyRange(): void {
    const employeeId = this.effectiveEmployeeId();
    if (employeeId) {
      this.fetch(employeeId);
    }
  }

  refetch(): void {
    const employeeId = this.effectiveEmployeeId();
    if (employeeId) {
      this.fetch(employeeId);
    }
  }

  onAdd(): void {
    const employeeId = this.effectiveEmployeeId();
    if (!employeeId) {
      return;
    }
    this.add.emit({ employeeId, date: new Date() });
  }

  onEdit(entry: RosterEntryDto): void {
    this.edit.emit(entry);
  }

  confirmDelete(entry: RosterEntryDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('ROSTER.PERSONAL.CONFIRM_DELETE'),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.rosterEntriesService.delete(entry.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('ROSTER.PERSONAL.DELETED'));
            this.refetch();
          },
          error: () => {},
        });
      },
    });
  }

  entryTimeLabel(entry: RosterEntryDto): string {
    return entry.startTime && entry.endTime ? `${entry.startTime.slice(0, 5)} – ${entry.endTime.slice(0, 5)}` : '';
  }

  private fetch(employeeId: string): void {
    this.loading.set(true);
    this.rosterEntriesService
      .personal({ employeeId, from: toStartOfDayIso(this.fromDate()), to: toEndOfDayIso(this.toDate()) })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => this.data.set(result));
  }
}
