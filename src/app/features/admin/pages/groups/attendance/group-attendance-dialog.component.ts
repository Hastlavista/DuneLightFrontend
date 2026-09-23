import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { finalize, forkJoin, of } from 'rxjs';
import {
  AppointmentStatus,
  BookingDto,
  BookingStatus,
  PAYMENT_METHODS,
  PaymentMethod,
  appointmentStatusSeverity,
  appointmentStatusTranslationKey,
  bookingStatusSeverity,
  bookingStatusTranslationKey,
  paymentMethodTranslationKey,
} from '../../../../../core/models/appointment.model';
import { ClientPackageDto } from '../../../../../core/models/client-package.model';
import { AttendanceEntry, CoverageType, coverageTypeTranslationKey } from '../../../../../core/models/group-attendance.model';
import { GroupAppointmentCellDto, GroupDto } from '../../../../../core/models/group.model';
import { WaitlistEntryDto, waitlistEntryStatusSeverity, waitlistEntryStatusTranslationKey } from '../../../../../core/models/waitlist.model';
import { AppointmentsService } from '../../../../../core/services/appointments.service';
import { ClientPackagesService } from '../../../../../core/services/client-packages.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { GroupAttendanceService } from '../../../../../core/services/group-attendance.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { resolveWarningMessage } from '../../../../../core/utils/warning-translation.util';
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
  /** True once eligiblePackages has resolved to an empty list (SinglePaid -
   * this client has no package covering the service) - the row waits for an
   * explicit payment-method choice (or "naplati kasnije") before check-in is
   * submitted, instead of silently checking the client in unpaid. */
  needsPaymentMethod: boolean;
  /** In-flight PATCH .../confirm (Phase 4 correction) or .../cancel (Phase 4
   * seat cancellation) for this row - separate from `saving` (the attended
   * checkbox flow) since they hit different endpoints/grants and can't run
   * concurrently on the same row. */
  correcting: boolean;
  cancelling: boolean;
}

export interface AttendanceRowVm {
  clientId: string;
  clientName: string;
  isMember: boolean;
  attended: boolean;
  coverageType?: CoverageType;
  eligiblePackages: ClientPackageDto[] | null;
  saving: boolean;
  needsPaymentMethod: boolean;
  /** Real per-client BookingStatus, merged in from GET .../bookings - GroupAttendanceEntryDto.attended
   * collapses NoShow/Cancelled into the same `false` and can't tell an
   * unresolved Confirmed row from a NoShow one, so this is the only reliable
   * source for the status badge and for gating the correction/cancel actions
   * below. Undefined for an `expected` row that has no Booking at all yet. */
  bookingStatus?: BookingStatus;
  cancellationReason?: string;
  correcting: boolean;
  cancelling: boolean;
}

/**
 * Attendance (+ Phase 4: status correction and occurrence-scoped waitlist) for
 * one group appointment occurrence. Per confirmed UX: ticking "attended"
 * auto-saves immediately (POST per row - SetGroupAttendanceRequest only ever
 * carries one clientId, there is no batch endpoint); when a client has more
 * than one eligible package an inline select appears first and the row saves
 * as soon as one is picked. Un-ticking a SessionPackage row returns its entry
 * automatically server-side - no confirmation prompt for that, unlike
 * individual appointments. Guests are added via an inline search at the
 * bottom - picking a result appends an unchecked row that follows the exact
 * same coverage flow as everyone else once ticked.
 *
 * Phase 4 additions layer on top without touching any of the above: an
 * explicit "vrati na potvrđeno" action (PATCH .../confirm) for any row whose
 * real BookingStatus is Completed/NoShow/Cancelled, an explicit "otkaži" seat
 * action for Confirmed rows, a reserved-seats capacity line (Confirmed
 * booking count, NOT the roster/attended counts), an occurrence-scoped
 * waitlist section (future occurrences only), and a "završi termin" action.
 * These hit AppointmentsController/GroupAppointmentsController endpoints
 * (appointments.write.own/all), a different grant than the attendance
 * checkbox flow above (groups.attendance.own/all) - see ACTION_POLICIES.
 */
@Component({
  selector: 'app-group-attendance-dialog',
  imports: [Dialog, TableModule, FormsModule, AutoComplete, Select, Button, Tag, TranslatePipe, EligiblePackageSelectComponent],
  templateUrl: './group-attendance-dialog.component.html',
  styleUrl: './group-attendance-dialog.component.scss',
})
export class GroupAttendanceDialogComponent {
  private readonly attendanceService = inject(GroupAttendanceService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly clientsService = inject(ClientsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly hrDatePipe = new HrDatePipe();

  readonly visible = model(false);
  readonly group = input<GroupDto | null>(null);
  readonly appointment = input<GroupAppointmentCellDto | null>(null);

  /** Emitted after any mutation that can change the parent group's occurrence
   * list/occupancy (seat cancel/correct, waitlist join/cancel, complete) -
   * mirrors GroupMembersSectionComponent's `changed` output so
   * GroupFormComponent can refetch GroupDetailDto the same way. Plain
   * attendance check-in/out does NOT emit this (it never changes occupancy). */
  readonly changed = output<void>();

  readonly loading = signal(false);
  readonly dialogShown = signal(false);

  private readonly expectedEntries = signal<AttendanceEntry[]>([]);
  private readonly recordedEntries = signal<AttendanceEntry[]>([]);
  private readonly pendingGuests = signal<AttendanceEntry[]>([]);
  private readonly rowUi = signal<Map<string, RowUiState>>(new Map());
  private readonly bookingsByClient = signal<Map<string, BookingDto>>(new Map());

  readonly waitlistEntries = signal<WaitlistEntryDto[]>([]);
  readonly joiningWaitlist = signal(false);
  readonly cancellingWaitlistClientId = signal<string | null>(null);
  readonly waitlistSearching = signal(false);
  readonly waitlistResults = signal<ClientSearchOption[]>([]);
  selectedWaitlistOption: ClientSearchOption | null = null;

  readonly completing = signal(false);

  readonly guestSearching = signal(false);
  readonly guestResults = signal<ClientSearchOption[]>([]);
  selectedGuestOption: ClientSearchOption | null = null;

  readonly coverageTypeTranslationKey = coverageTypeTranslationKey;
  readonly bookingStatusSeverity = bookingStatusSeverity;
  readonly bookingStatusTranslationKey = bookingStatusTranslationKey;
  readonly appointmentStatusSeverity = appointmentStatusSeverity;
  readonly appointmentStatusTranslationKey = appointmentStatusTranslationKey;
  readonly waitlistEntryStatusSeverity = waitlistEntryStatusSeverity;
  readonly waitlistEntryStatusTranslationKey = waitlistEntryStatusTranslationKey;

  /** Status of the occurrence itself (Scheduled/Completed/Cancelled), fetched
   * from GET /api/appointments/{id} (AppointmentDto.status) - GroupAppointmentCellDto
   * (the row shape feeding this dialog) carries no status of its own, so this
   * is the only reliable source. Null until loaded (or for a user without
   * either grant below). Gates the "Završi termin" action and the completed
   * badge - a future-dated occurrence can already be Completed (e.g. logged
   * early/out of band), and without this the action would still appear valid
   * and fail with 409 ALREADY_COMPLETED on click. */
  readonly appointmentStatus = signal<AppointmentStatus | null>(null);

  /** True once the "Završi termin" action is actually valid for this occurrence
   * - false for a known-Completed/Cancelled status. Null (not yet loaded) fails
   * open to the pre-existing behavior rather than hiding the button while the
   * fetch below is still in flight. */
  readonly canCompleteAppointment = computed(() => {
    const status = this.appointmentStatus();
    return status === null || status === 'Scheduled';
  });

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly paymentMethodOptions = computed(() => {
    this.translationsReady();
    return PAYMENT_METHODS.map((method) => ({ label: this.translate.instant(paymentMethodTranslationKey(method)), value: method }));
  });

  readonly expectedRows = computed<AttendanceRowVm[]>(() => this.expectedEntries().map((entry) => this.toRowVm(entry)));

  readonly recordedRows = computed<AttendanceRowVm[]>(() => {
    const recorded = this.recordedEntries().map((entry) => this.toRowVm(entry));
    const recordedIds = new Set(recorded.map((row) => row.clientId));
    const pending = this.pendingGuests()
      .filter((entry) => !recordedIds.has(entry.clientId))
      .map((entry) => this.toRowVm(entry));
    return [...recorded, ...pending];
  });

  /** Reserved future seats = Confirmed bookings only - see BookingStatus's
   * doc. Completed/NoShow/Cancelled rows never count here, even after the
   * occurrence starts and factual attendance may exceed the configured
   * capacity (deliberately not blocked/capped in this UI). */
  readonly reservedCount = computed(() => {
    let count = 0;
    for (const booking of this.bookingsByClient().values()) {
      if (booking.status === 'Confirmed') {
        count++;
      }
    }
    return count;
  });

  readonly capacityLabel = computed(() => {
    const group = this.group();
    return group ? `${this.reservedCount()}/${group.capacity}` : '';
  });

  readonly waitingWaitlistEntries = computed(() => this.waitlistEntries().filter((entry) => entry.status === 'Waiting'));

  /** GET .../bookings and .../waitlist require `appointments.view` - a
   * different grant family than groups.attendance.* (see ACTION_POLICIES's
   * doc). A Member/trainer holding only groups.attendance.own would get a
   * 403 on those calls, so the Phase 4 additions (status badges, capacity
   * line, correction/cancel actions, waitlist) only render for a user who
   * also holds appointments.view - the Phase 1 checkbox flow below keeps
   * working either way, since it never depends on this. */
  readonly hasAppointmentsView = computed(() => this.currentEmployeeService.hasAnyGrant(['appointments.view']));

  constructor() {
    effect(() => {
      const appointment = this.appointment();
      if (this.visible() && appointment) {
        this.resetState();
        this.refetch(appointment.id);
      } else {
        this.refetchToken++;
        this.loading.set(false);
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  /** "23.07.2026. 14:05" - same Croatian date convention as HrDatePipe, plus
   * local wall-clock time, for a full ISO DateTimeOffset (WaitlistEntryDto's
   * joinedAt/promotedAt). */
  waitlistTimestampLabel(value: string): string {
    const time = new Date(value).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
    return `${this.hrDatePipe.transform(value)} ${time}`;
  }

  subtitle(appointment: GroupAppointmentCellDto): string {
    return this.translate.instant('GROUPS.ATTENDANCE.SUBTITLE', {
      date: this.hrDatePipe.transform(appointment.startsAt),
      time: new Date(appointment.startsAt).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }),
      company: appointment.companyName,
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  /** Future-only per the waitlist's backend rule (Join is rejected for a past
   * or already-resolved occurrence) - a UI-side hint, the backend remains the
   * final authority (see WaitlistService.Join). GroupAppointmentCellDto
   * carries no occurrence status, so a cancelled-but-still-future occurrence
   * may still show this section; a join attempt against it is simply
   * rejected with the normal error toast. */
  isFutureOccurrence(): boolean {
    const appointment = this.appointment();
    if (!appointment) {
      return false;
    }
    return new Date(appointment.startsAt).getTime() > Date.now();
  }

  onToggleAttended(row: AttendanceRowVm, attended: boolean): void {
    if (!this.currentEmployeeService.can('groups.attendance.manage')) {
      return;
    }
    this.patchRowUi(row.clientId, { pendingAttended: attended });

    if (!attended) {
      this.submitAttendance(row.clientId, false, null);
      return;
    }

    if (row.eligiblePackages !== null) {
      this.checkInAfterEligiblePackagesResolved(row.clientId, row.eligiblePackages);
      return;
    }

    const group = this.group();
    if (!group) {
      return;
    }

    this.patchRowUi(row.clientId, { saving: true });
    this.clientPackagesService.getEligible(row.clientId, group.serviceId, this.appointment()?.startsAt).subscribe((eligible) => {
      this.patchRowUi(row.clientId, { eligiblePackages: eligible, saving: false });
      this.checkInAfterEligiblePackagesResolved(row.clientId, eligible);
    });
  }

  onPackageChosen(row: AttendanceRowVm, clientPackageId: string): void {
    this.submitAttendance(row.clientId, true, clientPackageId);
  }

  /** SinglePaid path (see RowUiState.needsPaymentMethod's doc) - checks the
   * client in without recording a Payment, billed later through the
   * Checkout/Payment API once that exists. */
  onSkipPayment(row: AttendanceRowVm): void {
    this.submitAttendance(row.clientId, true, null);
  }

  onPaymentMethodChosen(row: AttendanceRowVm, method: PaymentMethod): void {
    this.submitAttendance(row.clientId, true, null, method);
  }

  /** 0 eligible packages (SinglePaid) no longer auto-submits unpaid - it waits
   * for an explicit payment-method choice (see needsPaymentMethod's doc).
   * Exactly 1 still auto-selects and submits immediately, same as before. */
  private checkInAfterEligiblePackagesResolved(clientId: string, eligible: ClientPackageDto[]): void {
    if (eligible.length === 1) {
      this.submitAttendance(clientId, true, eligible[0].id);
      return;
    }
    if (eligible.length === 0) {
      this.patchRowUi(clientId, { needsPaymentMethod: true, pendingAttended: null });
    }
  }

  canCorrectToConfirmed(row: AttendanceRowVm): boolean {
    return row.bookingStatus === 'Completed' || row.bookingStatus === 'NoShow' || row.bookingStatus === 'Cancelled';
  }

  canCancelSeat(row: AttendanceRowVm): boolean {
    return row.bookingStatus === 'Confirmed';
  }

  /** PATCH .../confirm correction (Completed/NoShow/Cancelled -> Confirmed) -
   * see AppointmentsService.confirmBooking's doc for the side effects
   * (payment void, package-entry restore, notification cancel) this refetch
   * picks up; never simulated locally. */
  confirmCorrectToConfirmed(row: AttendanceRowVm): void {
    if (!this.currentEmployeeService.can('appointments.manage')) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('GROUPS.ATTENDANCE.CONFIRM_CORRECTION', { name: row.clientName }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => this.correctToConfirmed(row),
    });
  }

  private correctToConfirmed(row: AttendanceRowVm): void {
    const appointment = this.appointment();
    if (!appointment) {
      return;
    }
    this.patchRowUi(row.clientId, { correcting: true });
    this.appointmentsService
      .confirmBooking(appointment.id, row.clientId)
      .pipe(finalize(() => this.patchRowUi(row.clientId, { correcting: false })))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.ATTENDANCE.CORRECTED'));
          this.refetch(appointment.id);
          this.changed.emit();
        },
        error: () => {},
      });
  }

  /** Cancels only this client's seat (BookingStatus -> Cancelled), freeing it
   * for waitlist promotion server-side - never simulated locally, the
   * refetch below is what reveals a promoted waitlist entry if one existed. */
  confirmCancelSeat(row: AttendanceRowVm): void {
    if (!this.currentEmployeeService.can('appointments.manage')) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('GROUPS.ATTENDANCE.CONFIRM_CANCEL_SEAT', { name: row.clientName }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => this.cancelSeat(row),
    });
  }

  private cancelSeat(row: AttendanceRowVm): void {
    const appointment = this.appointment();
    if (!appointment) {
      return;
    }
    this.patchRowUi(row.clientId, { cancelling: true });
    this.appointmentsService
      .cancelBooking(appointment.id, row.clientId, { returnPackageEntry: false, cancellationReason: null })
      .pipe(finalize(() => this.patchRowUi(row.clientId, { cancelling: false })))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.ATTENDANCE.SEAT_CANCELLED'));
          this.refetch(appointment.id);
          this.changed.emit();
        },
        error: () => {},
      });
  }

  // Latest-request-wins: suggestions for an older search term must not replace newer ones.
  private waitlistSearchToken = 0;
  private guestSearchToken = 0;

  onWaitlistSearch(event: AutoCompleteCompleteEvent): void {
    const term = event.query.trim();
    const token = ++this.waitlistSearchToken;
    if (!term) {
      this.waitlistResults.set([]);
      return;
    }

    const excluded = new Set<string>([
      ...Array.from(this.bookingsByClient().values())
        .filter((booking) => booking.status === 'Confirmed')
        .map((booking) => booking.clientId),
      ...this.waitingWaitlistEntries().map((entry) => entry.clientId),
    ]);

    this.waitlistSearching.set(true);
    this.clientsService
      .getPage({ page: 1, pageSize: GUEST_SEARCH_PAGE_SIZE, search: term, isActive: true }, { suppressErrorToast: true })
      .pipe(finalize(() => token === this.waitlistSearchToken && this.waitlistSearching.set(false)))
      .subscribe((result) => {
        if (token !== this.waitlistSearchToken) {
          return;
        }
        this.waitlistResults.set(
          result.items
            .filter((client) => !excluded.has(client.id))
            .map((client) => ({ clientId: client.id, name: `${client.firstName} ${client.lastName}` })),
        );
      });
  }

  /** Guarded against a duplicate submit while a join is already in flight
   * (see spec #27 - no client-side dedupe of ALREADY_WAITLISTED beyond that,
   * the backend's partial unique constraint / 409 is the real guard). */
  onWaitlistClientSelected(event: AutoCompleteSelectEvent): void {
    const option = event.value as ClientSearchOption;
    this.selectedWaitlistOption = null;
    const appointment = this.appointment();
    if (!appointment || this.joiningWaitlist()) {
      return;
    }
    this.joiningWaitlist.set(true);
    this.appointmentsService
      .joinWaitlist(appointment.id, option.clientId)
      .pipe(finalize(() => this.joiningWaitlist.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.WAITLIST.JOINED'));
          this.waitlistResults.set([]);
          this.refetch(appointment.id);
        },
        error: () => {},
      });
  }

  confirmCancelWaitlistEntry(entry: WaitlistEntryDto): void {
    if (!this.currentEmployeeService.can('appointments.manage')) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('GROUPS.WAITLIST.CONFIRM_CANCEL', { name: entry.clientName }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => this.cancelWaitlistEntry(entry),
    });
  }

  private cancelWaitlistEntry(entry: WaitlistEntryDto): void {
    const appointment = this.appointment();
    if (!appointment) {
      return;
    }
    this.cancellingWaitlistClientId.set(entry.clientId);
    this.appointmentsService
      .cancelWaitlistEntry(appointment.id, entry.clientId)
      .pipe(finalize(() => this.cancellingWaitlistClientId.set(null)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.WAITLIST.CANCELLED'));
          this.refetch(appointment.id);
        },
        error: () => {},
      });
  }

  /** PATCH .../complete - occurrence-level "done", independent of any single
   * Booking's status. Allowed with unresolved (Confirmed) bookings still on
   * it - the response's warnings (GROUP_APPOINTMENT_UNRESOLVED_BOOKINGS) are
   * shown as a non-blocking toast, the operation itself still succeeded. */
  confirmCompleteAppointment(): void {
    if (!this.currentEmployeeService.can('appointments.manage') || !this.canCompleteAppointment()) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('GROUPS.ATTENDANCE.CONFIRM_COMPLETE'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => this.completeAppointment(),
    });
  }

  private completeAppointment(): void {
    const appointment = this.appointment();
    if (!appointment) {
      return;
    }
    this.completing.set(true);
    this.attendanceService
      .completeAppointment(appointment.id)
      .pipe(finalize(() => this.completing.set(false)))
      .subscribe({
        next: (updated) => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.ATTENDANCE.COMPLETED'));
          for (const warning of updated.warnings) {
            this.notifications.showWarning(resolveWarningMessage(this.translate, warning));
          }
          this.changed.emit();
          this.visible.set(false);
        },
        error: () => {},
      });
  }

  onGuestSearch(event: AutoCompleteCompleteEvent): void {
    const term = event.query.trim();
    const token = ++this.guestSearchToken;
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
      .pipe(finalize(() => token === this.guestSearchToken && this.guestSearching.set(false)))
      .subscribe((result) => {
        if (token !== this.guestSearchToken) {
          return;
        }
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
    const booking = this.bookingsByClient().get(entry.clientId);
    return {
      clientId: entry.clientId,
      clientName: entry.clientName,
      isMember: entry.isMember,
      attended: ui?.pendingAttended ?? (entry.attended ?? false),
      coverageType: entry.coverageType,
      eligiblePackages: ui?.eligiblePackages ?? null,
      saving: ui?.saving ?? false,
      needsPaymentMethod: ui?.needsPaymentMethod ?? false,
      bookingStatus: booking?.status,
      cancellationReason: booking?.cancellationReason,
      correcting: ui?.correcting ?? false,
      cancelling: ui?.cancelling ?? false,
    };
  }

  private submitAttendance(clientId: string, attended: boolean, clientPackageId: string | null, paymentMethod?: PaymentMethod): void {
    const appointment = this.appointment();
    if (!appointment) {
      return;
    }

    this.patchRowUi(clientId, { saving: true, needsPaymentMethod: false });
    this.attendanceService
      .setAttendance(appointment.id, { clientId, attended, clientPackageId, paymentMethod, isPaid: true, note: null })
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.ATTENDANCE.SAVED'));
          this.refetch(appointment.id);
          this.changed.emit();
        },
        error: () => this.patchRowUi(clientId, { saving: false, pendingAttended: null }),
      });
  }

  // Closing and reopening for another occurrence must never show (and record
  // check-ins against) the previous occurrence's attendance list.
  private refetchToken = 0;

  private refetch(appointmentId: string): void {
    const token = ++this.refetchToken;
    this.loading.set(true);
    const canSeeBookings = this.hasAppointmentsView();
    const bookings$ = canSeeBookings ? this.appointmentsService.getBookings(appointmentId) : of<BookingDto[]>([]);
    const waitlist$ =
      canSeeBookings && this.isFutureOccurrence() ? this.appointmentsService.getWaitlist(appointmentId) : of<WaitlistEntryDto[]>([]);
    /** Same appointments.view boundary as bookings$/waitlist$ above - GET
     * /api/appointments/{id} sits behind the same grant, so reusing
     * canSeeBookings here avoids a 403 for a manage-only (write grant, no
     * view grant) user; that edge case simply keeps today's behavior
     * (appointmentStatus() stays null, canCompleteAppointment() fails open). */
    const appointment$ = canSeeBookings ? this.appointmentsService.getById(appointmentId) : of(null);
    forkJoin({
      attendance: this.attendanceService.getAttendance(appointmentId),
      bookings: bookings$,
      waitlist: waitlist$,
      appointment: appointment$,
    })
      .pipe(
        finalize(() => {
          if (token === this.refetchToken) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe(({ attendance, bookings, waitlist, appointment }) => {
        if (token !== this.refetchToken) {
          return;
        }
        this.expectedEntries.set(attendance.expected);
        this.recordedEntries.set(attendance.recorded);
        this.bookingsByClient.set(new Map(bookings.map((booking) => [booking.clientId, booking])));
        this.waitlistEntries.set(waitlist);
        this.appointmentStatus.set(appointment?.status ?? null);
        this.pendingGuests.update((list) => list.filter((guest) => !attendance.recorded.some((r) => r.clientId === guest.clientId)));
        this.rowUi.set(new Map());
      });
  }

  private patchRowUi(clientId: string, patch: Partial<RowUiState>): void {
    this.rowUi.update((map) => {
      const next = new Map(map);
      const current =
        next.get(clientId) ?? { eligiblePackages: null, pendingAttended: null, saving: false, needsPaymentMethod: false, correcting: false, cancelling: false };
      next.set(clientId, { ...current, ...patch });
      return next;
    });
  }

  private resetState(): void {
    this.expectedEntries.set([]);
    this.recordedEntries.set([]);
    this.pendingGuests.set([]);
    this.rowUi.set(new Map());
    this.bookingsByClient.set(new Map());
    this.waitlistEntries.set([]);
    this.appointmentStatus.set(null);
    this.guestResults.set([]);
    this.selectedGuestOption = null;
    this.waitlistResults.set([]);
    this.selectedWaitlistOption = null;
  }
}
