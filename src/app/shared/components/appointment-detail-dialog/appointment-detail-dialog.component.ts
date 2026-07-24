import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { AppError } from '../../../core/models/api-error.model';
import {
  AppointmentCancelRequest,
  AppointmentClientRef,
  AppointmentCompleteRequest,
  AppointmentDto,
  PAYMENT_METHODS,
  PackageSelection,
  PaymentMethod,
  appointmentStatusSeverity,
  appointmentStatusTranslationKey,
  paymentMethodTranslationKey,
} from '../../../core/models/appointment.model';
import { ClientPackageDto } from '../../../core/models/client-package.model';
import { EmployeeDto } from '../../../core/models/employee.model';
import { LocationDto } from '../../../core/models/location.model';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { ClientPackagesService } from '../../../core/services/client-packages.service';
import { NotificationService } from '../../../core/services/notification.service';
import { toLocalIsoFromDate } from '../../../core/utils/date.util';
import { translationReadySignal } from '../../../core/utils/translation-signal.util';
import { EligiblePackageSelectComponent } from '../eligible-package-select/eligible-package-select.component';
import { EurCurrencyPipe } from '../../pipes/eur-currency.pipe';

interface SelectOption {
  label: string;
  value: string;
}

interface PackageRowState {
  eligible: ClientPackageDto[] | null;
  loading: boolean;
}

type DetailMode = 'view' | 'billing' | 'cancel' | 'noShow';

/**
 * Appointment detail (GET /api/appointments/{id}) plus:
 * - an inline edit form for moving it - time/trainer/location are the only
 *   editable fields there, everything else (service, clients, price, status,
 *   note) stays read-only. "Spremi" calls the same PATCH /{id}/move endpoint
 *   ScheduleGridComponent's drag & drop used to call directly; a modal form is
 *   more reliable to hit than pixel-precise dragging, especially for short
 *   appointments.
 * - "Naplati" (Scheduled only) - reveals a payment-method + per-client package
 *   picker (same EligiblePackageSelectComponent/0-1-many rule as
 *   NewAppointmentDialogComponent) and calls PATCH /{id}/complete, resending
 *   the appointment's own already-known fields since that endpoint takes the
 *   same full AppointmentCompleteRequest shape as creating one.
 * - "Otkaži"/"Nije došao" (Scheduled only) - separate flows, not a shared
 *   toggle: cancel defaults every returnable client's "vrati ulazak" checkbox
 *   ON, no-show defaults it OFF. Both list only appt.clients entries where
 *   packageEntryDeducted && !packageEntryReturned - that per-client pair is
 *   the real state (see AppointmentClientRef's doc), not something derived
 *   from a single appointment-level payment field.
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
    Checkbox,
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
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly appointmentId = input<string | null>(null);
  readonly employees = input<EmployeeDto[]>([]);
  readonly locations = input<LocationDto[]>([]);
  readonly allowEmployeeChange = input(false);

  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly appointment = signal<AppointmentDto | null>(null);

  readonly mode = signal<DetailMode>('view');

  readonly billingPaymentMethod = signal<PaymentMethod | null>(null);
  readonly billingSaving = signal(false);
  readonly billingAttempted = signal(false);
  private readonly billingPackageRows = signal<Map<string, PackageRowState>>(new Map());
  private readonly billingSelectedPackages = signal<Map<string, string | null>>(new Map());

  readonly cancelSaving = signal(false);
  readonly noShowSaving = signal(false);
  private readonly returnEntryByClient = signal<Map<string, boolean>>(new Map());

  readonly appointmentStatusTranslationKey = appointmentStatusTranslationKey;
  readonly appointmentStatusSeverity = appointmentStatusSeverity;

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly isMovable = computed(() => {
    const appt = this.appointment();
    return appt !== null && appt.status !== 'Cancelled' && appt.status !== 'NoShow';
  });

  /** "Naplati"/"Otkaži"/"Nije došao" only make sense for a still-Scheduled
   * appointment - already Completed/Cancelled/NoShow disables all three. */
  readonly isScheduled = computed(() => this.appointment()?.status === 'Scheduled');

  readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map((employee) => ({ label: `${employee.firstName} ${employee.lastName}`, value: employee.id })),
  );

  readonly locationOptions = computed<SelectOption[]>(() =>
    this.locations().map((location) => ({ label: location.name, value: location.id })),
  );

  readonly paymentMethodOptions = computed<SelectOption[]>(() => {
    this.translationsReady();
    return PAYMENT_METHODS.map((method) => ({ label: this.translate.instant(paymentMethodTranslationKey(method)), value: method }));
  });

  readonly form = this.fb.nonNullable.group({
    startsAt: this.fb.control<Date | null>(null, Validators.required),
    employeeId: this.fb.nonNullable.control<string>('', Validators.required),
    locationId: this.fb.nonNullable.control<string>('', Validators.required),
  });

  constructor() {
    effect(() => {
      const id = this.appointmentId();
      if (this.visible() && id) {
        this.fetch(id);
      } else if (!this.visible()) {
        this.appointment.set(null);
        this.form.reset({ startsAt: null, employeeId: '', locationId: '' });
        this.mode.set('view');
      }
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSave(): void {
    const appt = this.appointment();
    if (!appt || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request = {
      startsAt: toLocalIsoFromDate(raw.startsAt as Date),
      locationId: raw.locationId,
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
          result.warnings.forEach((warning) => this.notifications.showWarning(warning));
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
    return appointment.clients.map((client) => client.clientName).join(', ');
  }

  onOpenBilling(): void {
    this.mode.set('billing');
    this.billingPaymentMethod.set(null);
    this.billingAttempted.set(false);
    this.billingPackageRows.set(new Map());
    this.billingSelectedPackages.set(new Map());
  }

  onBillingPaymentMethodChange(method: PaymentMethod): void {
    this.billingPaymentMethod.set(method);
    if (method === 'Package') {
      this.refreshBillingEligiblePackages();
    } else {
      this.billingPackageRows.set(new Map());
      this.billingSelectedPackages.set(new Map());
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
    const method = this.billingPaymentMethod();
    if (!method) {
      return false;
    }
    if (method !== 'Package') {
      return true;
    }
    return this.buildBillingPackageSelections() !== null;
  }

  onConfirmBilling(): void {
    this.billingAttempted.set(true);
    const appt = this.appointment();
    const method = this.billingPaymentMethod();
    if (!appt || !method || !this.canConfirmBilling()) {
      return;
    }

    const request: AppointmentCompleteRequest = {
      startsAt: appt.startsAt,
      serviceId: appt.serviceId,
      employeeId: appt.employeeId,
      locationId: appt.locationId,
      clientIds: appt.clients.map((client) => client.clientId),
      amount: appt.price,
      note: appt.note ?? null,
      paymentMethod: method,
      packageSelections: method === 'Package' ? (this.buildBillingPackageSelections() ?? []) : [],
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

  returnableClients(): AppointmentClientRef[] {
    return (this.appointment()?.clients ?? []).filter((client) => client.packageEntryDeducted && !client.packageEntryReturned);
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

  private buildBillingPackageSelections(): PackageSelection[] | null {
    const appt = this.appointment();
    if (!appt) {
      return null;
    }
    const selections: PackageSelection[] = [];
    for (const client of appt.clients) {
      const packageId = this.billingSelectedPackages().get(client.clientId);
      if (!packageId) {
        return null;
      }
      selections.push({ clientId: client.clientId, clientPackageId: packageId });
    }
    return selections;
  }

  private refreshBillingEligiblePackages(): void {
    const appt = this.appointment();
    if (!appt) {
      return;
    }

    const initialState = new Map<string, PackageRowState>();
    for (const client of appt.clients) {
      initialState.set(client.clientId, { eligible: null, loading: true });
    }
    this.billingPackageRows.set(initialState);
    this.billingSelectedPackages.set(new Map());

    for (const client of appt.clients) {
      this.clientPackagesService.getEligible(client.clientId, appt.serviceId, appt.startsAt).subscribe((eligible) => {
        this.billingPackageRows.update((map) => {
          const next = new Map(map);
          next.set(client.clientId, { eligible, loading: false });
          return next;
        });
        if (eligible.length <= 1) {
          const packageId = eligible[0]?.id ?? null;
          if (packageId) {
            this.billingSelectedPackages.update((map) => {
              const next = new Map(map);
              next.set(client.clientId, packageId);
              return next;
            });
          }
        }
      });
    }
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.appointment.set(null);
    this.mode.set('view');
    this.appointmentsService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((dto) => {
        this.appointment.set(dto);
        this.form.reset({
          startsAt: new Date(dto.startsAt),
          employeeId: dto.employeeId,
          locationId: dto.locationId,
        });
        if (dto.status === 'Cancelled' || dto.status === 'NoShow') {
          this.form.disable();
        } else {
          this.form.enable();
        }
      });
  }
}
