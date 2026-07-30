import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { finalize } from 'rxjs';
import { AppError } from '../../../core/models/api-error.model';
import {
  AppointmentCompleteRequest,
  AppointmentCreateRequest,
  PAYMENT_METHODS,
  PackageSelection,
  PaymentMethod,
  RECURRENCE_TYPES,
  RecurrenceType,
  RecurringAppointmentCreateRequest,
  RecurringConflictDetail,
  paymentMethodTranslationKey,
  recurrenceTypeTranslationKey,
  recurringConflictReasonTranslationKey,
} from '../../../core/models/appointment.model';
import { ClientDto } from '../../../core/models/client.model';
import { ClientPackageDto } from '../../../core/models/client-package.model';
import { EmployeeSummary } from '../../../core/models/employee.model';
import { LocationDto } from '../../../core/models/location.model';
import { ServiceDto } from '../../../core/models/service.model';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { ClientPackagesService } from '../../../core/services/client-packages.service';
import { ClientsService } from '../../../core/services/clients.service';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PriceListService } from '../../../core/services/price-list.service';
import { toEndOfDayIso, toLocalIsoFromDate } from '../../../core/utils/date.util';
import { translationReadySignal } from '../../../core/utils/translation-signal.util';
import { EligiblePackageSelectComponent } from '../eligible-package-select/eligible-package-select.component';

const CLIENT_SEARCH_PAGE_SIZE = 10;

/** "23.07.2026. 17:00" - same Intl-direct rationale as EurCurrencyPipe/HrDatePipe,
 * just with the time-of-day the RECURRING_CONFLICT panel needs and those don't
 * carry. */
const CONFLICT_DATE_FORMATTER = new Intl.DateTimeFormat('hr-HR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface SelectOption {
  label: string;
  value: string;
}

interface ClientSearchOption {
  clientId: string;
  name: string;
}

interface ClientPackageRowState {
  eligible: ClientPackageDto[] | null;
  loading: boolean;
}

/** Prefill for the form, resolved by the caller before opening - either from a
 * schedule grid's empty-slot click (own date/trainer/location context) or a
 * blank "Novi termin" toolbar button (only startsAt defaults to now). */
export interface NewAppointmentInitial {
  startsAt?: Date | null;
  employeeId?: string | null;
  locationId?: string | null;
}

/**
 * "Novi termin" - covers all three ways an appointment gets created: plain
 * schedule (POST /schedule), immediately billed (POST /complete, with a
 * per-client package selection when paymentMethod is Package - reuses
 * EligiblePackageSelectComponent, same 0/1/>1 rule as Grupe's attendance
 * modal), and a recurring series (POST /recurring, never billed immediately -
 * every instance is created Scheduled).
 *
 * Trainer field is locked to the logged-in employee for role Member - the
 * backend rejects a termin created for someone else (NOT_OWNER) but there's no
 * reason to let a trainer pick a wrong name and hit that error at all.
 *
 * `409 APPOINTMENT_OVERLAP` (schedule/complete) is left to the default error
 * toast - the form simply stays open (no visible.set(false) on error), the
 * user changes trainer/time/client and retries. `409 RECURRING_CONFLICT`
 * (recurring) is handled locally instead - see AppointmentsService.createRecurring's
 * doc - and rendered as a conflict-date panel above the actions instead of a
 * toast, since a whole list needs to stay legible rather than flash by.
 */
@Component({
  selector: 'app-new-appointment-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    FormsModule,
    Select,
    DatePicker,
    InputNumber,
    Textarea,
    ToggleSwitch,
    AutoComplete,
    Button,
    TranslatePipe,
    EligiblePackageSelectComponent,
  ],
  templateUrl: './new-appointment-dialog.component.html',
  styleUrl: './new-appointment-dialog.component.scss',
})
export class NewAppointmentDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly clientsService = inject(ClientsService);
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly priceListService = inject(PriceListService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly employees = input<EmployeeSummary[]>([]);
  readonly locations = input<LocationDto[]>([]);
  readonly services = input<ServiceDto[]>([]);
  readonly initial = input<NewAppointmentInitial | null>(null);

  readonly created = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);
  readonly attemptedSubmit = signal(false);

  readonly isRecurring = signal(false);
  readonly completeNow = signal(false);

  readonly selectedClients = signal<ClientSearchOption[]>([]);
  readonly clientSearching = signal(false);
  readonly clientResults = signal<ClientSearchOption[]>([]);

  readonly recurringConflicts = signal<RecurringConflictDetail[] | null>(null);

  private readonly packageRowState = signal<Map<string, ClientPackageRowState>>(new Map());
  private readonly selectedPackageByClient = signal<Map<string, string | null>>(new Map());

  readonly recurringConflictReasonTranslationKey = recurringConflictReasonTranslationKey;

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly isMemberRole = computed(() => this.currentEmployeeService.employee()?.role === 'Member');

  readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map((employee) => ({ label: `${employee.firstName} ${employee.lastName}`, value: employee.id })),
  );

  readonly paymentMethodOptions = computed<SelectOption[]>(() => {
    this.translationsReady();
    return PAYMENT_METHODS.map((method) => ({ label: this.translate.instant(paymentMethodTranslationKey(method)), value: method }));
  });

  readonly recurrenceTypeOptions = computed<SelectOption[]>(() => {
    this.translationsReady();
    return RECURRENCE_TYPES.map((type) => ({ label: this.translate.instant(recurrenceTypeTranslationKey(type)), value: type }));
  });

  readonly form = this.fb.nonNullable.group({
    serviceId: this.fb.nonNullable.control<string>('', Validators.required),
    employeeId: this.fb.nonNullable.control<string>('', Validators.required),
    locationId: this.fb.nonNullable.control<string>('', Validators.required),
    startsAt: this.fb.control<Date | null>(null, Validators.required),
    note: this.fb.nonNullable.control<string>(''),
    amount: this.fb.control<number | null>(null),
    paymentMethod: this.fb.control<PaymentMethod | null>(null),
    recurrenceType: this.fb.control<RecurrenceType | null>(null),
    endDate: this.fb.control<Date | null>(null),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm();
      } else {
        this.dialogShown.set(false);
      }
    });

    effect(() => {
      // Re-run whenever the picked clients change, so a client added/removed
      // while paymentMethod is already Package keeps the package rows in sync.
      this.selectedClients();
      this.refreshEligiblePackages();
    });

    this.form.controls.serviceId.valueChanges.subscribe(() => {
      this.refreshSuggestedAmount();
      this.refreshEligiblePackages();
    });
    this.form.controls.locationId.valueChanges.subscribe(() => this.refreshSuggestedAmount());
    this.form.controls.startsAt.valueChanges.subscribe(() => {
      this.refreshSuggestedAmount();
      this.refreshEligiblePackages();
    });
    this.form.controls.paymentMethod.valueChanges.subscribe(() => this.refreshEligiblePackages());
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onRecurringToggle(value: boolean): void {
    this.isRecurring.set(value);
    if (value) {
      this.completeNow.set(false);
      this.form.controls.paymentMethod.setValue(null);
    }
  }

  onCompleteNowToggle(value: boolean): void {
    this.completeNow.set(value);
    if (!value) {
      this.form.controls.paymentMethod.setValue(null);
    }
  }

  onClientSearch(event: AutoCompleteCompleteEvent): void {
    const term = event.query.trim();
    if (!term) {
      this.clientResults.set([]);
      return;
    }
    const excluded = new Set(this.selectedClients().map((client) => client.clientId));
    this.clientSearching.set(true);
    this.clientsService
      .getPage({ page: 1, pageSize: CLIENT_SEARCH_PAGE_SIZE, search: term, isActive: true }, { suppressErrorToast: true })
      .pipe(finalize(() => this.clientSearching.set(false)))
      .subscribe((result) => {
        this.clientResults.set(
          result.items
            .filter((client: ClientDto) => !excluded.has(client.id))
            .map((client: ClientDto) => ({ clientId: client.id, name: `${client.firstName} ${client.lastName}` })),
        );
      });
  }

  onSelectedClientsChange(clients: ClientSearchOption[]): void {
    this.selectedClients.set(clients);
  }

  serviceDurationMinutes(serviceId: string | null): number | null {
    return this.services().find((service) => service.id === serviceId)?.defaultDurationMinutes ?? null;
  }

  conflictDateLabel(iso: string): string {
    return CONFLICT_DATE_FORMATTER.format(new Date(iso));
  }

  packageRow(clientId: string): ClientPackageRowState {
    return this.packageRowState().get(clientId) ?? { eligible: null, loading: false };
  }

  selectedPackageId(clientId: string): string | null {
    return this.selectedPackageByClient().get(clientId) ?? null;
  }

  onPackageChosen(clientId: string, clientPackageId: string): void {
    this.setSelectedPackage(clientId, clientPackageId);
  }

  canConfirmComplete(): boolean {
    if (this.form.controls.paymentMethod.value !== 'Package') {
      return true;
    }
    return this.buildPackageSelections() !== null;
  }

  onSubmit(): void {
    this.attemptedSubmit.set(true);

    if (
      this.selectedClients().length === 0 ||
      this.form.controls.serviceId.invalid ||
      this.form.controls.employeeId.invalid ||
      this.form.controls.locationId.invalid ||
      this.form.controls.startsAt.invalid
    ) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isRecurring()) {
      if (!this.form.controls.recurrenceType.value || !this.form.controls.endDate.value) {
        return;
      }
      this.submitRecurring();
    } else if (this.completeNow()) {
      if (!this.form.controls.paymentMethod.value || !this.canConfirmComplete()) {
        return;
      }
      this.submitComplete();
    } else {
      this.submitCreate();
    }
  }

  private submitCreate(): void {
    const raw = this.form.getRawValue();
    const request: AppointmentCreateRequest = {
      startsAt: toLocalIsoFromDate(raw.startsAt as Date),
      serviceId: raw.serviceId,
      employeeId: raw.employeeId,
      locationId: raw.locationId,
      clientIds: this.selectedClients().map((client) => client.clientId),
      amount: raw.amount,
      note: raw.note || null,
    };

    this.saving.set(true);
    this.appointmentsService
      .create(request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.NEW_APPOINTMENT.SCHEDULED'));
          this.visible.set(false);
          this.created.emit();
        },
        error: () => {},
      });
  }

  private submitComplete(): void {
    const raw = this.form.getRawValue();
    const packageSelections = this.buildPackageSelections() ?? [];
    const request: AppointmentCompleteRequest = {
      startsAt: toLocalIsoFromDate(raw.startsAt as Date),
      serviceId: raw.serviceId,
      employeeId: raw.employeeId,
      locationId: raw.locationId,
      clientIds: this.selectedClients().map((client) => client.clientId),
      amount: raw.amount,
      note: raw.note || null,
      paymentMethod: raw.paymentMethod as PaymentMethod,
      packageSelections,
    };

    this.saving.set(true);
    this.appointmentsService
      .complete(request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.NEW_APPOINTMENT.COMPLETED'));
          this.visible.set(false);
          this.created.emit();
        },
        error: () => {},
      });
  }

  private submitRecurring(): void {
    const raw = this.form.getRawValue();
    const request: RecurringAppointmentCreateRequest = {
      recurrenceType: raw.recurrenceType as RecurrenceType,
      serviceId: raw.serviceId,
      employeeId: raw.employeeId,
      locationId: raw.locationId,
      clientIds: this.selectedClients().map((client) => client.clientId),
      firstOccurrenceStartsAt: toLocalIsoFromDate(raw.startsAt as Date),
      endDate: toEndOfDayIso(raw.endDate as Date),
      note: raw.note || null,
    };

    this.recurringConflicts.set(null);
    this.saving.set(true);
    this.appointmentsService
      .createRecurring(request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (results) => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.NEW_APPOINTMENT.RECURRING_CREATED', { count: results.length }));
          this.visible.set(false);
          this.created.emit();
        },
        error: (err: AppError) => {
          if (err.code === 'RECURRING_CONFLICT') {
            const details = err.details as unknown as { conflicts?: RecurringConflictDetail[] } | undefined;
            this.recurringConflicts.set(details?.conflicts ?? []);
          } else {
            this.notifications.showAppError(err);
          }
        },
      });
  }

  private buildPackageSelections(): PackageSelection[] | null {
    const selections: PackageSelection[] = [];
    for (const client of this.selectedClients()) {
      const packageId = this.selectedPackageId(client.clientId);
      if (!packageId) {
        return null;
      }
      selections.push({ clientId: client.clientId, clientPackageId: packageId });
    }
    return selections;
  }

  private setSelectedPackage(clientId: string, packageId: string | null): void {
    this.selectedPackageByClient.update((map) => {
      const next = new Map(map);
      next.set(clientId, packageId);
      return next;
    });
  }

  private refreshEligiblePackages(): void {
    if (this.form.controls.paymentMethod.value !== 'Package') {
      this.packageRowState.set(new Map());
      this.selectedPackageByClient.set(new Map());
      return;
    }

    const serviceId = this.form.controls.serviceId.value;
    const clients = this.selectedClients();
    if (!serviceId || clients.length === 0) {
      this.packageRowState.set(new Map());
      this.selectedPackageByClient.set(new Map());
      return;
    }

    const startsAt = this.form.controls.startsAt.value;
    const date = startsAt ? toLocalIsoFromDate(startsAt) : undefined;

    const initialState = new Map<string, ClientPackageRowState>();
    for (const client of clients) {
      initialState.set(client.clientId, { eligible: null, loading: true });
    }
    this.packageRowState.set(initialState);
    this.selectedPackageByClient.update((map) => {
      const next = new Map<string, string | null>();
      for (const client of clients) {
        next.set(client.clientId, map.get(client.clientId) ?? null);
      }
      return next;
    });

    for (const client of clients) {
      this.clientPackagesService.getEligible(client.clientId, serviceId, date).subscribe((eligible) => {
        this.packageRowState.update((map) => {
          const next = new Map(map);
          next.set(client.clientId, { eligible, loading: false });
          return next;
        });
        if (eligible.length <= 1) {
          this.setSelectedPackage(client.clientId, eligible[0]?.id ?? null);
        }
      });
    }
  }

  private refreshSuggestedAmount(): void {
    const serviceId = this.form.controls.serviceId.value;
    const locationId = this.form.controls.locationId.value;
    const startsAt = this.form.controls.startsAt.value ?? new Date();
    if (!serviceId || !locationId) {
      return;
    }
    this.priceListService
      .resolve({ subjectType: 'Service', subjectId: serviceId, locationId, date: toLocalIsoFromDate(startsAt) })
      .subscribe({
        next: (result) => this.form.controls.amount.setValue(result.price, { emitEvent: false }),
        error: () => {},
      });
  }

  private resetForm(): void {
    const init = this.initial();
    const locked = this.isMemberRole();
    const selfId = this.currentEmployeeService.employee()?.employeeId ?? '';

    this.form.reset({
      serviceId: '',
      employeeId: locked ? selfId : (init?.employeeId ?? ''),
      locationId: init?.locationId ?? '',
      startsAt: init?.startsAt ?? new Date(),
      note: '',
      amount: null,
      paymentMethod: null,
      recurrenceType: null,
      endDate: null,
    });

    if (locked) {
      this.form.controls.employeeId.disable();
    } else {
      this.form.controls.employeeId.enable();
    }

    this.selectedClients.set([]);
    this.clientResults.set([]);
    this.isRecurring.set(false);
    this.completeNow.set(false);
    this.recurringConflicts.set(null);
    this.packageRowState.set(new Map());
    this.selectedPackageByClient.set(new Map());
    this.attemptedSubmit.set(false);
  }
}
