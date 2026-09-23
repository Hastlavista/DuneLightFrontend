import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { AppError } from '../../../core/models/api-error.model';
import {
  AppointmentCancelRequest,
  AppointmentClientSettlement,
  AppointmentCompleteRequest,
  AppointmentDto,
  AppointmentMoveRequest,
  BookingDto,
  PAYMENT_METHODS,
  PaymentMethod,
  appointmentStatusSeverity,
  appointmentStatusTranslationKey,
  bookingStatusSeverity,
  bookingStatusTranslationKey,
  paymentMethodTranslationKey,
} from '../../../core/models/appointment.model';
import { ClientPackageDto } from '../../../core/models/client-package.model';
import { EmployeeSummary } from '../../../core/models/employee.model';
import { StudioCompany } from '../../../core/models/company.model';
import { RoomDto } from '../../../core/models/room.model';
import { AvailabilityDto } from '../../../core/models/working-hours.model';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { AvailabilityService } from '../../../core/services/availability.service';
import { ClientPackagesService } from '../../../core/services/client-packages.service';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoomsService } from '../../../core/services/rooms.service';
import { toDateOnly, toLocalIsoFromDate } from '../../../core/utils/date.util';
import { isOutsideAvailability } from '../../../core/utils/scheduling-conflict.util';
import { translationReadySignal } from '../../../core/utils/translation-signal.util';
import { resolveWarningMessage } from '../../../core/utils/warning-translation.util';
import { EligiblePackageSelectComponent } from '../eligible-package-select/eligible-package-select.component';
import { EurCurrencyPipe } from '../../pipes/eur-currency.pipe';

const ROOM_LOOKUP_PAGE_SIZE = 200;

interface SelectOption {
  label: string;
  value: string;
}

interface PackageRowState {
  eligible: ClientPackageDto[] | null;
  loading: boolean;
}

type DetailMode = 'view' | 'billing' | 'cancel' | 'noShow';

/** Same "PaymentMethod or the pseudo-value 'Package'" per-booking billing
 * choice as NewAppointmentDialogComponent's SettlementChoice - see that
 * type's doc and AppointmentClientSettlement. */
type SettlementChoice = PaymentMethod | 'Package';

interface SettlementSelectOption {
  label: string;
  value: SettlementChoice;
}

/**
 * Appointment detail (GET /api/appointments/{id}) plus:
 * - an inline edit form for moving it - time/trainer/company are the only
 *   editable fields there, everything else (service, clients, price, status,
 *   note) stays read-only. "Spremi" calls the same PATCH /{id}/move endpoint
 *   ScheduleGridComponent's drag & drop used to call directly; a modal form is
 *   more reliable to hit than pixel-precise dragging, especially for short
 *   appointments.
 * - "Naplati" (Scheduled only) - reveals a per-booking settlement choice
 *   (payment method, or "Paket" + the EligiblePackageSelectComponent 0/1/>1
 *   rule, same as NewAppointmentDialogComponent - see SettlementChoice) and
 *   calls PATCH /{id}/complete, resending the appointment's own already-known
 *   fields since that endpoint takes the same full AppointmentCompleteRequest
 *   shape as creating one.
 * - "Otkaži"/"Nije došao" (Scheduled only) - separate flows, not a shared
 *   toggle: cancel defaults every returnable booking's "vrati ulazak" checkbox
 *   ON, no-show defaults it OFF. Both list only appt.bookings entries where
 *   packageCoverageApplied && !packageCoverageReturned - that per-booking pair
 *   is the real state (see BookingDto's doc), not something derived from a
 *   single appointment-level payment field.
 * `mode` gates which of these is showing; switching `appointmentId` or
 * closing the dialog always resets it back to 'view'.
 *
 * `employees`/`allowEmployeeChange` are only set by ScheduleDayGridComponent
 * (grid A, day x trainers) - ScheduleWeekGridComponent (grid B, week x one
 * trainer) leaves `allowEmployeeChange` false since the trainer is already
 * fixed by which grid instance this is, and the dialog hides that field
 * entirely rather than showing a single-option dropdown.
 */
@Component({
  selector: 'app-appointment-detail-dialog',
  imports: [
    Dialog,
    Tag,
    ReactiveFormsModule,
    FormsModule,
    Select,
    DatePicker,
    Button,
    TranslatePipe,
    EurCurrencyPipe,
    EligiblePackageSelectComponent,
  ],
  templateUrl: './appointment-detail-dialog.component.html',
  styleUrl: './appointment-detail-dialog.component.scss',
})
export class AppointmentDetailDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly availabilityService = inject(AvailabilityService);
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly roomsService = inject(RoomsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly visible = model(false);
  readonly appointmentId = input<string | null>(null);
  readonly employees = input<EmployeeSummary[]>([]);
  readonly companies = input<StudioCompany[]>([]);
  readonly allowEmployeeChange = input(false);

  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly appointment = signal<AppointmentDto | null>(null);

  readonly mode = signal<DetailMode>('view');

  readonly billingSaving = signal(false);
  readonly billingAttempted = signal(false);
  private readonly billingSettlementChoiceMap = signal<Map<string, SettlementChoice | null>>(new Map());
  private readonly billingPackageRows = signal<Map<string, PackageRowState>>(new Map());
  private readonly billingSelectedPackages = signal<Map<string, string | null>>(new Map());

  readonly cancelSaving = signal(false);
  readonly noShowSaving = signal(false);
  private readonly returnEntryByClient = signal<Map<string, boolean>>(new Map());

  /** clientId of the Booking currently being corrected back to Confirmed (PATCH
   * .../confirm) - null when none is in flight. Per-row, not a single flag,
   * since a multi-client Individual appointment can have several Completed
   * bookings and only one is ever being corrected at a time. */
  readonly correctingClientId = signal<string | null>(null);

  readonly appointmentStatusTranslationKey = appointmentStatusTranslationKey;
  readonly appointmentStatusSeverity = appointmentStatusSeverity;
  readonly bookingStatusTranslationKey = bookingStatusTranslationKey;
  readonly bookingStatusSeverity = bookingStatusSeverity;

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly isMovable = computed(() => {
    const appt = this.appointment();
    return appt !== null && appt.status !== 'Cancelled';
  });

  /** "Naplati"/"Otkaži"/"Nije došao" only make sense for a still-Scheduled
   * appointment - already Completed/Cancelled disables all three (there is no
   * appointment-level NoShow - see AppointmentStatus's doc). */
  readonly isScheduled = computed(() => this.appointment()?.status === 'Scheduled');

  readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map((employee) => ({ label: `${employee.firstName} ${employee.lastName}`, value: employee.id })),
  );

  readonly companyOptions = computed<SelectOption[]>(() =>
    this.companies().map((company) => ({ label: company.name, value: company.id })),
  );

  /** Rooms of the move form's currently-picked company - same trigger/shape
   * as NewAppointmentDialogComponent.roomsForCompany. */
  readonly roomsForCompany = signal<RoomDto[]>([]);

  readonly roomOptions = computed<SelectOption[]>(() => this.roomsForCompany().map((room) => ({ label: room.name, value: room.id })));

  /** Trainer pre-save warning for the move form (frontend #27) - same
   * soft/non-blocking treatment as NewAppointmentDialogComponent's
   * `availability`/`startsAtOutsideAvailability`, see
   * scheduling-conflict.util.ts. Room/trainer *double-booking* is
   * deliberately NOT checked here - that stays a hard, unconditional 409 on
   * the backend, so there's nothing a "continue anyway" could ever override. */
  readonly availability = signal<AvailabilityDto | null>(null);

  readonly startsAtOutsideAvailability = computed<boolean>(() => {
    const avail = this.availability();
    const startsAt = this.form.controls.startsAt.value;
    if (!avail || !startsAt) {
      return false;
    }
    const minutes = startsAt.getHours() * 60 + startsAt.getMinutes();
    return isOutsideAvailability(minutes, minutes, avail.effectiveIntervals);
  });

  readonly settlementChoiceOptions = computed<SettlementSelectOption[]>(() => {
    this.translationsReady();
    return [
      ...PAYMENT_METHODS.map((method) => ({ label: this.translate.instant(paymentMethodTranslationKey(method)), value: method as SettlementChoice })),
      { label: this.translate.instant('SCHEDULE.PACKAGE_COVERAGE'), value: 'Package' as SettlementChoice },
    ];
  });

  readonly form = this.fb.nonNullable.group({
    startsAt: this.fb.control<Date | null>(null, Validators.required),
    employeeId: this.fb.nonNullable.control<string>('', Validators.required),
    companyId: this.fb.nonNullable.control<string>('', Validators.required),
    roomId: this.fb.control<string | null>(null),
  });

  // Latest-request-wins tokens (reopen for another appointment, company/date edits).
  private fetchToken = 0;
  private roomsToken = 0;
  private availabilityToken = 0;
  private readonly eligibleTokens = new Map<string, number>();
  /** Company the current roomId belongs to - lets a real user company change
   * drop the room without the fetch()'s own form.reset() wiping it. */
  private roomCompanyId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.appointmentId();
      if (this.visible() && id) {
        this.fetch(id);
      } else if (!this.visible()) {
        this.fetchToken++;
        this.loading.set(false);
        this.roomCompanyId = null;
        this.appointment.set(null);
        this.form.reset({ startsAt: null, employeeId: '', companyId: '', roomId: null });
        this.roomsForCompany.set([]);
        this.availability.set(null);
        this.mode.set('view');
      }
    });

    this.form.controls.companyId.valueChanges.subscribe((companyId) => {
      if (companyId !== this.roomCompanyId) {
        this.form.controls.roomId.setValue(null, { emitEvent: false });
        this.roomCompanyId = companyId || null;
      }
      this.refreshRooms();
      this.refreshAvailability();
    });
    this.form.controls.employeeId.valueChanges.subscribe(() => this.refreshAvailability());
    this.form.controls.startsAt.valueChanges.subscribe(() => this.refreshAvailability());
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.appointment()) {
      return;
    }

    this.confirmSchedulingWarningsThenMove();
  }

  /** Soft (non-blocking) pre-save check (frontend #27) - see
   * NewAppointmentDialogComponent's identical treatment and
   * scheduling-conflict.util.ts. */
  private confirmSchedulingWarningsThenMove(): void {
    const reasons: string[] = [];
    if (this.startsAtOutsideAvailability()) {
      reasons.push(
        this.translate.instant('SCHEDULING_WARNINGS.TRAINER_OUTSIDE_HOURS', {
          name: this.employeeOptions().find((option) => option.value === this.form.controls.employeeId.value)?.label ?? '',
        }),
      );
    }

    if (reasons.length === 0) {
      this.performMove(false);
      return;
    }

    this.confirmationService.confirm({
      header: this.translate.instant('SCHEDULING_WARNINGS.CONFIRM_HEADER'),
      message: `${reasons.join(' ')} ${this.translate.instant('SCHEDULING_WARNINGS.CONFIRM_MESSAGE')}`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('SCHEDULING_WARNINGS.CONTINUE_ANYWAY'),
      rejectLabel: this.translate.instant('COMMON.CANCEL'),
      acceptButtonProps: { severity: 'warn' },
      // See AppointmentMoveRequest.overrideAvailability's doc - without this,
      // the confirmed retry would hit the exact same 409 again.
      accept: () => this.performMove(true),
    });
  }

  private performMove(overrideAvailability: boolean): void {
    const appt = this.appointment();
    if (!appt) {
      return;
    }

    const raw = this.form.getRawValue();
    // roomId is always resent (like companyId, unlike the opt-in employeeId) -
    // per the backend contract a null value here means "leave unchanged," not
    // "clear," so picking "bez prostorije" on an appointment that already has
    // a room assigned is a no-op, not a clear - that would need a PUT this
    // dialog doesn't call (see AppointmentMoveRequest.roomId's doc comment).
    const request: AppointmentMoveRequest = {
      startsAt: toLocalIsoFromDate(raw.startsAt as Date),
      companyId: raw.companyId,
      roomId: raw.roomId || null,
      overrideAvailability,
      ...(this.allowEmployeeChange() ? { employeeId: raw.employeeId } : {}),
    };

    this.saving.set(true);
    this.appointmentsService
      .move(appt.id, request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.visible.set(false);
          this.saved.emit();
          result.warnings.forEach((warning) => this.notifications.showWarning(resolveWarningMessage(this.translate, warning)));
        },
        error: () => {},
      });
  }

  timeRangeLabel(appointment: AppointmentDto): string {
    const start = new Date(appointment.startsAt);
    const end = new Date(start.getTime() + appointment.durationMinutes * 60000);
    const format = (date: Date) => `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    return `${format(start)} – ${format(end)} (${appointment.durationMinutes} min)`;
  }

  clientsLabel(appointment: AppointmentDto): string {
    if (appointment.form === 'Group') {
      return appointment.groupName ?? '';
    }
    return appointment.bookings.map((booking) => booking.clientName).join(', ');
  }

  onOpenBilling(): void {
    this.mode.set('billing');
    this.billingAttempted.set(false);
    this.billingSettlementChoiceMap.set(new Map());
    this.billingPackageRows.set(new Map());
    this.billingSelectedPackages.set(new Map());
  }

  billingSettlementChoice(clientId: string): SettlementChoice | null {
    return this.billingSettlementChoiceMap().get(clientId) ?? null;
  }

  onBillingSettlementChoiceChange(clientId: string, choice: SettlementChoice): void {
    this.billingSettlementChoiceMap.update((map) => {
      const next = new Map(map);
      next.set(clientId, choice);
      return next;
    });
    if (choice === 'Package') {
      this.refreshBillingEligiblePackagesForClient(clientId);
    } else {
      this.billingPackageRows.update((map) => {
        const next = new Map(map);
        next.delete(clientId);
        return next;
      });
      this.billingSelectedPackages.update((map) => {
        const next = new Map(map);
        next.delete(clientId);
        return next;
      });
    }
  }

  billingPackageRow(clientId: string): PackageRowState {
    return this.billingPackageRows().get(clientId) ?? { eligible: null, loading: false };
  }

  onBillingPackageChosen(clientId: string, clientPackageId: string): void {
    this.billingSelectedPackages.update((map) => {
      const next = new Map(map);
      next.set(clientId, clientPackageId);
      return next;
    });
  }

  canConfirmBilling(): boolean {
    return this.buildBillingSettlements() !== null;
  }

  onConfirmBilling(): void {
    this.billingAttempted.set(true);
    const appt = this.appointment();
    const settlements = this.buildBillingSettlements();
    if (!appt || !settlements) {
      return;
    }

    const request: AppointmentCompleteRequest = {
      startsAt: appt.startsAt,
      serviceId: appt.serviceId,
      employeeId: appt.employeeId,
      companyId: appt.companyId,
      clientIds: appt.bookings.map((booking) => booking.clientId),
      note: appt.note ?? null,
      overrideAvailability: false,
      settlements,
    };

    this.billingSaving.set(true);
    this.appointmentsService
      .completeExisting(appt.id, request)
      .pipe(finalize(() => this.billingSaving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.BILL.COMPLETED'));
          this.visible.set(false);
          this.saved.emit();
        },
        error: (err: AppError) => {
          // Someone else already billed it in the meantime - refresh so the
          // dialog reflects the real (now Completed) state instead of still
          // offering "Naplati" on stale data.
          if (err.code === 'ALREADY_COMPLETED') {
            this.mode.set('view');
            this.fetch(appt.id);
          }
        },
      });
  }

  onOpenCancel(): void {
    this.mode.set('cancel');
    this.initReturnEntryDefaults(true);
  }

  onOpenNoShow(): void {
    this.mode.set('noShow');
    this.initReturnEntryDefaults(false);
  }

  onBackToView(): void {
    this.mode.set('view');
  }

  /** "Vrati na potvrđeno" (PATCH .../confirm) is available for an Individual
   * Booking at Completed or NoShow. Cancelled remains terminal; Group correction
   * has its own surface (GroupAttendanceDialogComponent). */
  canCorrectBooking(appointment: AppointmentDto, booking: BookingDto): boolean {
    return appointment.form === 'Individual' && (booking.status === 'Completed' || booking.status === 'NoShow');
  }

  /** Meaningful, potentially multi-effect correction (payment void, package
   * restore, commission reversal, Appointment reverting to Scheduled) - always
   * confirmed first, same pattern as GroupAttendanceDialogComponent's identical
   * correction action. */
  confirmCorrectBooking(booking: BookingDto): void {
    if (!this.currentEmployeeService.can('appointments.manage')) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('SCHEDULE.DETAIL.CONFIRM_CORRECTION', { name: booking.clientName }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => this.correctBooking(booking),
    });
  }

  private correctBooking(booking: BookingDto): void {
    const appt = this.appointment();
    if (!appt) {
      return;
    }
    this.correctingClientId.set(booking.clientId);
    this.appointmentsService
      .confirmBooking(appt.id, booking.clientId)
      .pipe(finalize(() => this.correctingClientId.set(null)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.DETAIL.CORRECTED'));
          // Server-authoritative refresh (frontend #Correction) - the response
          // above is only the corrected BookingDto; Appointment.Status, sibling
          // bookings, payments and package-coverage fields may all have
          // changed and must come from a fresh GET, never be patched locally.
          this.fetch(appt.id);
          this.saved.emit();
        },
        error: () => {},
      });
  }

  returnableClients(): BookingDto[] {
    return (this.appointment()?.bookings ?? []).filter((booking) => booking.packageCoverageApplied && !booking.packageCoverageReturned);
  }

  isReturnEntryChecked(clientId: string): boolean {
    return this.returnEntryByClient().get(clientId) ?? false;
  }

  onToggleReturnEntry(clientId: string, checked: boolean): void {
    this.returnEntryByClient.update((map) => {
      const next = new Map(map);
      next.set(clientId, checked);
      return next;
    });
  }

  onConfirmCancel(): void {
    const appt = this.appointment();
    if (!appt) {
      return;
    }
    const request: AppointmentCancelRequest = { returnEntryForClientIds: this.selectedReturnClientIds() };
    this.cancelSaving.set(true);
    this.appointmentsService
      .cancel(appt.id, request)
      .pipe(finalize(() => this.cancelSaving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.CANCEL.CANCELLED'));
          this.visible.set(false);
          this.saved.emit();
        },
        error: () => {},
      });
  }

  onConfirmNoShow(): void {
    const appt = this.appointment();
    if (!appt) {
      return;
    }
    const request: AppointmentCancelRequest = { returnEntryForClientIds: this.selectedReturnClientIds() };
    this.noShowSaving.set(true);
    this.appointmentsService
      .noShow(appt.id, request)
      .pipe(finalize(() => this.noShowSaving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.NO_SHOW.MARKED'));
          this.visible.set(false);
          this.saved.emit();
        },
        error: () => {},
      });
  }

  private initReturnEntryDefaults(defaultChecked: boolean): void {
    const map = new Map<string, boolean>();
    for (const client of this.returnableClients()) {
      map.set(client.clientId, defaultChecked);
    }
    this.returnEntryByClient.set(map);
  }

  private selectedReturnClientIds(): string[] {
    return Array.from(this.returnEntryByClient().entries())
      .filter(([, checked]) => checked)
      .map(([clientId]) => clientId);
  }

  /** Builds one AppointmentClientSettlement per booking on this appointment, or
   * null while any booking still needs a choice made - same rule as
   * NewAppointmentDialogComponent.buildSettlements. Per-booking amount
   * override isn't exposed here (same simplification as the new-appointment
   * dialog) - omitted, the backend resolves each client's own suggested
   * price. */
  private buildBillingSettlements(): AppointmentClientSettlement[] | null {
    const appt = this.appointment();
    if (!appt) {
      return null;
    }
    const settlements: AppointmentClientSettlement[] = [];
    for (const booking of appt.bookings) {
      const choice = this.billingSettlementChoice(booking.clientId);
      if (!choice) {
        return null;
      }
      if (choice === 'Package') {
        const packageId = this.billingSelectedPackages().get(booking.clientId);
        if (!packageId) {
          return null;
        }
        settlements.push({ clientId: booking.clientId, clientPackageId: packageId, isPaid: true });
      } else {
        settlements.push({ clientId: booking.clientId, paymentMethod: choice, isPaid: true });
      }
    }
    return settlements;
  }

  private refreshBillingEligiblePackagesForClient(clientId: string): void {
    const appt = this.appointment();
    if (!appt) {
      return;
    }

    this.billingPackageRows.update((map) => {
      const next = new Map(map);
      next.set(clientId, { eligible: null, loading: true });
      return next;
    });

    const token = (this.eligibleTokens.get(clientId) ?? 0) + 1;
    this.eligibleTokens.set(clientId, token);
    const isLatest = () => this.eligibleTokens.get(clientId) === token && this.appointment()?.id === appt.id;
    this.clientPackagesService.getEligible(clientId, appt.serviceId, appt.startsAt).subscribe({
      next: (eligible) => {
        if (!isLatest()) {
          return;
        }
        this.billingPackageRows.update((map) => {
          const next = new Map(map);
          next.set(clientId, { eligible, loading: false });
          return next;
        });
        if (eligible.length <= 1) {
          const packageId = eligible[0]?.id ?? null;
          if (packageId) {
            this.billingSelectedPackages.update((map) => {
              const next = new Map(map);
              next.set(clientId, packageId);
              return next;
            });
          }
        }
      },
      // Never leave the billing row spinning (and billing blocked) after a failure.
      error: () => {
        if (!isLatest()) {
          return;
        }
        this.billingPackageRows.update((map) => {
          const next = new Map(map);
          next.set(clientId, { eligible: [], loading: false });
          return next;
        });
      },
    });
  }

  private refreshRooms(): void {
    const companyId = this.form.controls.companyId.value;
    const token = ++this.roomsToken;
    if (!companyId) {
      this.roomsForCompany.set([]);
      return;
    }
    this.roomsService
      .getPage({ page: 1, pageSize: ROOM_LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true, extraParams: { companyId: companyId } })
      .subscribe({
        next: (result) => {
          if (token === this.roomsToken) {
            this.roomsForCompany.set(result.items);
          }
        },
        error: () => {
          if (token === this.roomsToken) {
            this.roomsForCompany.set([]);
          }
        },
      });
  }

  /** Mirrors NewAppointmentDialogComponent.refreshAvailability - same
   * GET /api/availability lookup, driving `startsAtOutsideAvailability`. */
  private refreshAvailability(): void {
    const employeeId = this.form.controls.employeeId.value;
    const companyId = this.form.controls.companyId.value;
    const startsAt = this.form.controls.startsAt.value;
    const token = ++this.availabilityToken;
    if (!employeeId || !companyId || !startsAt) {
      this.availability.set(null);
      return;
    }
    this.availabilityService
      .get({ employeeId, companyId, date: toDateOnly(startsAt) }, { suppressErrorToast: true })
      .subscribe({
        next: (result) => {
          if (token === this.availabilityToken) {
            this.availability.set(result);
          }
        },
        error: () => {
          if (token === this.availabilityToken) {
            this.availability.set(null);
          }
        },
      });
  }

  private fetch(id: string): void {
    const token = ++this.fetchToken;
    this.loading.set(true);
    this.appointment.set(null);
    this.mode.set('view');
    this.appointmentsService
      .getById(id)
      .pipe(
        finalize(() => {
          if (token === this.fetchToken) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe((dto) => {
        // Closed or reopened for another appointment meanwhile: every action in
        // this dialog would otherwise target the stale appointment.
        if (token !== this.fetchToken) {
          return;
        }
        this.appointment.set(dto);
        this.roomCompanyId = dto.companyId;
        this.form.reset({
          startsAt: new Date(dto.startsAt),
          employeeId: dto.employeeId,
          companyId: dto.companyId,
          roomId: dto.roomId ?? null,
        });
        if (dto.status === 'Cancelled') {
          this.form.disable();
        } else {
          this.form.enable();
        }
      });
  }
}
