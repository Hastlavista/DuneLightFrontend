import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { ClientPackageDto } from '../../../../../core/models/client-package.model';
import { AttendanceEntry, CoverageType, coverageTypeTranslationKey } from '../../../../../core/models/group-attendance.model';
import { GroupAppointmentCellDto, GroupDto } from '../../../../../core/models/group.model';
import { ClientPackagesService } from '../../../../../core/services/client-packages.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { GroupAttendanceService } from '../../../../../core/services/group-attendance.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { EligiblePackageSelectComponent } from '../../../../../shared/components/eligible-package-select/eligible-package-select.component';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';

const GUEST_SEARCH_PAGE_SIZE = 10;

interface ClientSearchOption {
  clientId: string;
  name: string;
}

interface RowUiState {
  eligiblePackages: ClientPackageDto[] | null;
  /** Optimistic override while a save is in flight - null means "no override,
   * follow the last-fetched entry.attended" (see toRowVm). Needed because a
   * plain OR can't represent an optimistic *uncheck*: if the previous fetch
   * still says attended: true, `false || true` would stay true and the
   * checkbox would appear stuck checked until the refetch lands. */
  pendingAttended: boolean | null;
  saving: boolean;
}

export interface AttendanceRowVm {
  clientId: string;
  clientName: string;
  isMember: boolean;
  attended: boolean;
  coverageType?: CoverageType;
  eligiblePackages: ClientPackageDto[] | null;
  saving: boolean;
}

/**
 * Attendance for one group appointment occurrence. Per confirmed UX: ticking
 * "attended" auto-saves immediately (POST per row - SetGroupAttendanceRequest
 * only ever carries one clientId, there is no batch endpoint); when a client
 * has more than one eligible package an inline select appears first and the
 * row saves as soon as one is picked. Un-ticking a SessionPackage row returns
 * its entry automatically server-side - no confirmation prompt for that,
 * unlike individual appointments. Guests are added via an inline search at
 * the bottom - picking a result appends an unchecked row that follows the
 * exact same coverage flow as everyone else once ticked.
 */
@Component({
  selector: 'app-group-attendance-dialog',
  imports: [Dialog, TableModule, Checkbox, FormsModule, AutoComplete, TranslatePipe, EligiblePackageSelectComponent],
  templateUrl: './group-attendance-dialog.component.html',
  styleUrl: './group-attendance-dialog.component.scss',
})
export class GroupAttendanceDialogComponent {
  private readonly attendanceService = inject(GroupAttendanceService);
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly clientsService = inject(ClientsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly hrDatePipe = new HrDatePipe();

  readonly visible = model(false);
  readonly group = input<GroupDto | null>(null);
  readonly appointment = input<GroupAppointmentCellDto | null>(null);

  readonly loading = signal(false);
  readonly dialogShown = signal(false);

  private readonly expectedEntries = signal<AttendanceEntry[]>([]);
  private readonly recordedEntries = signal<AttendanceEntry[]>([]);
  private readonly pendingGuests = signal<AttendanceEntry[]>([]);
  private readonly rowUi = signal<Map<string, RowUiState>>(new Map());

  readonly guestSearching = signal(false);
  readonly guestResults = signal<ClientSearchOption[]>([]);
  selectedGuestOption: ClientSearchOption | null = null;

  readonly coverageTypeTranslationKey = coverageTypeTranslationKey;

  readonly expectedRows = computed<AttendanceRowVm[]>(() => this.expectedEntries().map((entry) => this.toRowVm(entry)));

  readonly recordedRows = computed<AttendanceRowVm[]>(() => {
    const recorded = this.recordedEntries().map((entry) => this.toRowVm(entry));
    const recordedIds = new Set(recorded.map((row) => row.clientId));
    const pending = this.pendingGuests()
      .filter((entry) => !recordedIds.has(entry.clientId))
      .map((entry) => this.toRowVm(entry));
    return [...recorded, ...pending];
  });

  constructor() {
    effect(() => {
      const appointment = this.appointment();
      if (this.visible() && appointment) {
        this.resetState();
        this.refetch(appointment.id);
      } else {
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  subtitle(appointment: GroupAppointmentCellDto): string {
    return this.translate.instant('GROUPS.ATTENDANCE.SUBTITLE', {
      date: this.hrDatePipe.transform(appointment.date),
      time: appointment.startTime.slice(0, 5),
      location: appointment.companyName,
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onToggleAttended(row: AttendanceRowVm, attended: boolean): void {
    this.patchRowUi(row.clientId, { pendingAttended: attended });

    if (!attended) {
      this.submitAttendance(row.clientId, false, null);
      return;
    }

    if (row.eligiblePackages !== null) {
      if (row.eligiblePackages.length <= 1) {
        this.submitAttendance(row.clientId, true, row.eligiblePackages[0]?.id ?? null);
      }
      return;
    }

    const group = this.group();
    if (!group) {
      return;
    }

    this.patchRowUi(row.clientId, { saving: true });
    this.clientPackagesService.getEligible(row.clientId, group.serviceId, this.appointment()?.date).subscribe((eligible) => {
      this.patchRowUi(row.clientId, { eligiblePackages: eligible, saving: false });
      if (eligible.length <= 1) {
        this.submitAttendance(row.clientId, true, eligible[0]?.id ?? null);
      }
    });
  }

  onPackageChosen(row: AttendanceRowVm, clientPackageId: string): void {
    this.submitAttendance(row.clientId, true, clientPackageId);
  }

  onGuestSearch(event: AutoCompleteCompleteEvent): void {
    const term = event.query.trim();
    if (!term) {
      this.guestResults.set([]);
      return;
    }

    const excluded = new Set([
      ...this.expectedEntries().map((entry) => entry.clientId),
      ...this.recordedEntries().map((entry) => entry.clientId),
      ...this.pendingGuests().map((entry) => entry.clientId),
    ]);

    this.guestSearching.set(true);
    this.clientsService
      .getPage({ page: 1, pageSize: GUEST_SEARCH_PAGE_SIZE, search: term, isActive: true }, { suppressErrorToast: true })
      .pipe(finalize(() => this.guestSearching.set(false)))
      .subscribe((result) => {
        this.guestResults.set(
          result.items
            .filter((client) => !excluded.has(client.id))
            .map((client) => ({ clientId: client.id, name: `${client.firstName} ${client.lastName}` })),
        );
      });
  }

  onGuestSelected(event: AutoCompleteSelectEvent): void {
    const option = event.value as ClientSearchOption;
    this.pendingGuests.update((list) => [
      ...list,
      { clientId: option.clientId, clientName: option.name, isMember: false, attended: false },
    ]);
    this.selectedGuestOption = null;
  }

  private toRowVm(entry: AttendanceEntry): AttendanceRowVm {
    const ui = this.rowUi().get(entry.clientId);
    return {
      clientId: entry.clientId,
      clientName: entry.clientName,
      isMember: entry.isMember,
      attended: ui?.pendingAttended ?? (entry.attended ?? false),
      coverageType: entry.coverageType,
      eligiblePackages: ui?.eligiblePackages ?? null,
      saving: ui?.saving ?? false,
    };
  }

  private submitAttendance(clientId: string, attended: boolean, clientPackageId: string | null): void {
    const appointment = this.appointment();
    if (!appointment) {
      return;
    }

    this.patchRowUi(clientId, { saving: true });
    this.attendanceService
      .setAttendance(appointment.id, { clientId, attended, clientPackageId, note: null })
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.ATTENDANCE.SAVED'));
          this.refetch(appointment.id);
        },
        error: () => this.patchRowUi(clientId, { saving: false, pendingAttended: null }),
      });
  }

  private refetch(appointmentId: string): void {
    this.loading.set(true);
    this.attendanceService
      .getAttendance(appointmentId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((dto) => {
        this.expectedEntries.set(dto.expected);
        this.recordedEntries.set(dto.recorded);
        this.pendingGuests.update((list) => list.filter((guest) => !dto.recorded.some((r) => r.clientId === guest.clientId)));
        this.rowUi.set(new Map());
      });
  }

  private patchRowUi(clientId: string, patch: Partial<RowUiState>): void {
    this.rowUi.update((map) => {
      const next = new Map(map);
      const current = next.get(clientId) ?? { eligiblePackages: null, pendingAttended: null, saving: false };
      next.set(clientId, { ...current, ...patch });
      return next;
    });
  }

  private resetState(): void {
    this.expectedEntries.set([]);
    this.recordedEntries.set([]);
    this.pendingGuests.set([]);
    this.rowUi.set(new Map());
    this.guestResults.set([]);
    this.selectedGuestOption = null;
  }
}
