import { WarningDto } from './api-error.model';
import { CoverageType } from './group-attendance.model';
import { ServiceExecutionMode } from './service.model';

/** Status values exactly as the backend sends/accepts them - occurrence
 * (resource/slot) level, NOT per-client. `NoShow` deliberately does not exist
 * here - an appointment as such can't "not show up", only an individual
 * Booking on it can (see BookingStatus). A whole-appointment no-show (every
 * client) still lands in `Cancelled` here, with the per-client detail on each
 * Booking. */
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';

const STATUS_TRANSLATION_KEYS: Record<AppointmentStatus, string> = {
  Scheduled: 'SCHEDULE.STATUS.SCHEDULED',
  Completed: 'SCHEDULE.STATUS.COMPLETED',
  Cancelled: 'SCHEDULE.STATUS.CANCELLED',
};

export function appointmentStatusTranslationKey(status: AppointmentStatus): string {
  return STATUS_TRANSLATION_KEYS[status];
}

/** Display order for the status filter dropdown. */
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['Scheduled', 'Completed', 'Cancelled'];

const STATUS_SEVERITIES: Record<AppointmentStatus, 'info' | 'success' | 'danger' | 'warn'> = {
  Scheduled: 'info',
  Completed: 'success',
  Cancelled: 'danger',
};

export function appointmentStatusSeverity(status: AppointmentStatus): 'info' | 'success' | 'danger' | 'warn' {
  return STATUS_SEVERITIES[status];
}

/** Client-specific state of one Booking row (one client on one appointment) -
 * see BookingDto. `Confirmed` is the only non-terminal state; `Completed`/
 * `Cancelled`/`NoShow` are terminal except for an explicit admin/trainer
 * correction back to Confirmed via PATCH .../bookings/{clientId}/confirm (see
 * AppointmentsService.confirmBooking) - for Form=Group available from any
 * terminal status (Completed/NoShow/Cancelled -> Confirmed); for
 * Form=Individual deliberately narrower, available ONLY from Completed (undo
 * of a wrong check-in - Cancelled/NoShow have no way back). That correction
 * may void a check-in-generated Payment, restore a consumed package entry,
 * and reverse the earned CommissionEntry server-side, and for Individual also
 * reverts Appointment.Status back to Scheduled - so callers must always
 * reload the whole Appointment (bookings, payments/package fields, and
 * status) from a fresh GET rather than patch local state. */
export type BookingStatus = 'Confirmed' | 'Completed' | 'Cancelled' | 'NoShow';

const BOOKING_STATUS_TRANSLATION_KEYS: Record<BookingStatus, string> = {
  Confirmed: 'SCHEDULE.BOOKING_STATUS.CONFIRMED',
  Completed: 'SCHEDULE.BOOKING_STATUS.COMPLETED',
  Cancelled: 'SCHEDULE.BOOKING_STATUS.CANCELLED',
  NoShow: 'SCHEDULE.BOOKING_STATUS.NO_SHOW',
};

export function bookingStatusTranslationKey(status: BookingStatus): string {
  return BOOKING_STATUS_TRANSLATION_KEYS[status];
}

const BOOKING_STATUS_SEVERITIES: Record<BookingStatus, 'info' | 'success' | 'danger' | 'warn'> = {
  Confirmed: 'info',
  Completed: 'success',
  Cancelled: 'danger',
  NoShow: 'warn',
};

export function bookingStatusSeverity(status: BookingStatus): 'info' | 'success' | 'danger' | 'warn' {
  return BOOKING_STATUS_SEVERITIES[status];
}

/** Payment method values exactly as the backend sends/accepts them. There is
 * no `'Package'` value - package coverage is a separate concept
 * (BookingDto.packageCoverageApplied / AppointmentClientSettlement.clientPackageId),
 * mutually exclusive with a monetary PaymentMethod, never a PaymentMethod
 * value itself. */
export type PaymentMethod = 'Cash' | 'Card' | 'BankTransfer' | 'Other';

const PAYMENT_METHOD_TRANSLATION_KEYS: Record<PaymentMethod, string> = {
  Cash: 'SCHEDULE.PAYMENT_METHOD.CASH',
  Card: 'SCHEDULE.PAYMENT_METHOD.CARD',
  BankTransfer: 'SCHEDULE.PAYMENT_METHOD.BANK_TRANSFER',
  Other: 'SCHEDULE.PAYMENT_METHOD.OTHER',
};

export function paymentMethodTranslationKey(method: PaymentMethod): string {
  return PAYMENT_METHOD_TRANSLATION_KEYS[method];
}

/** Display order for the payment method select. */
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'BankTransfer', 'Other'];

/** Status of one Payment ledger row - see PaymentDto. */
export type PaymentStatus = 'Completed' | 'Voided';

/** One monetary settlement event against a Checkout (PaymentDtos.cs) -
 * surfaced read-only on BookingDto.payments; there is no dedicated Payment
 * model/service in this pass (that arrives with Checkout/POS). */
export interface PaymentDto {
  id: string;
  checkoutId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  note?: string;
  /** True = auto-created during check-in/complete (an
   * AppointmentClientSettlement/BookingSetStatusRequest with a paymentMethod),
   * false = added manually through the Checkout POS API. Informational only. */
  isCheckInGenerated: boolean;
  createdAt: string;
  createdBy?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

/** GET /api/appointments/schedule - one entry of `ScheduleFeedDto.appointments`
 * (frontend #22 - the endpoint used to return this as a bare flat array; see
 * ScheduleFeedDto in core/models/schedule-break.model.ts for the current
 * envelope). Backend omits null/absent fields from the JSON entirely rather
 * than sending an explicit null (see core/utils/date.util.ts's
 * PlusSafeUrlCodec note for the same convention elsewhere) - fields that can
 * be absent are typed with `?`, never `| null`. */
export interface AppointmentScheduleCellDto {
  id: string;
  startsAt: string;
  durationMinutes: number;
  serviceId: string;
  serviceName: string;
  serviceCategoryColorHex?: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  roomId?: string;
  roomName?: string;
  clientNames: string[];
  /** Index-aligned with `clientNames` - NOT sent by the backend yet (requested
   * for the birthday marker in schedule-cell-view.util.ts, which needs a
   * reliable id to match against GET /api/clients/birthdays instead of
   * matching on name, since two clients can share a name). Frontend treats
   * this as absent until the backend adds it - see toScheduleGridCell.
   *
   * NOTE: the backend's EmployeeId is technically nullable (Guid?) on this DTO
   * and on AppointmentDto, pre-dating the Booking/Payment refactor this pass
   * targets. Modeling that properly would ripple into schedule-grid column
   * keying and employee-assignment logic well outside this pass's scope
   * (Appointment/Booking billing reconciliation) - left as-is, matching the
   * frontend's pre-existing assumption that a scheduled appointment always has
   * a trainer. Flagged here, not silently "fixed" into a wider change. */
  clientIds?: string[];
  status: AppointmentStatus;
  isCancelled: boolean;
  form?: AppointmentForm;
  groupId?: string;
  groupName?: string;
  attendanceCount?: number;
  expectedCount?: number;
  /** Soft (non-blocking) scheduling issues on this specific occurrence -
   * EMPLOYEE_ON_BREAK/EMPLOYEE_ABSENT/OUTSIDE_WORKING_HOURS_WARNING/
   * COMPANY_CLOSED_HOLIDAY (see WarningDto) - same field/shape as
   * AppointmentDto.warnings, populated per-instance by
   * POST /groups/generate-appointments (see GenerateGroupAppointmentsResult.created).
   * Empty for a plain schedule-grid read. */
  warnings: WarningDto[];
}

/** Every appointment form value the backend can send. */
export type AppointmentForm = 'Individual' | 'Group';

/** One client's participation in one Appointment (BookingDto, Core/DTOs/Appointments/AppointmentDtos.cs).
 * Amount/PaidAmount/OutstandingAmount/IsPaid live HERE, per client - NOT on
 * AppointmentDto - since 2026-09-15 an appointment with multiple clients can
 * have genuinely mixed billing (e.g. a duo where one pays by package and the
 * other by card). PaidAmount/OutstandingAmount/IsPaid are derived from the
 * Payment ledger (BookingFinancialsCalculator), never persisted directly. */
export interface BookingDto {
  id: string;
  clientId: string;
  clientName: string;
  status: BookingStatus;
  amount: number;
  suggestedAmount: number;
  isAmountManuallyOverridden: boolean;
  paidAmount: number;
  outstandingAmount: number;
  isPaid: boolean;
  clientPackageId?: string;
  coverageType?: CoverageType;
  packageCoverageApplied: boolean;
  packageCoverageReturned: boolean;
  /** Full payment history of this booking (incl. voided), newest first. */
  payments: PaymentDto[];
  note?: string;
  cancellationReason?: string;
  /** Classification of the cancellation moment against
   * OrganizationSettings.CancellationCutoffMinutes - null except for a
   * client/booking-level cancellation. */
  isLateCancellation?: boolean;
}

/** GET /api/appointments/{id} and the body PATCH /{id}/move responds with (see
 * AppointmentsService.move). `bookings` replaces the old single appointment-
 * level amount/isPaid/paymentMethod/clientPackageId (see BookingDto's doc) -
 * frontend sums/derives aggregates itself where needed (e.g. "everything
 * paid"); this DTO deliberately does not duplicate per-booking totals.
 * `warnings` is transient - only ever populated on the move (and later
 * create/complete/update) response, always empty on a plain GET. */
export interface AppointmentDto {
  id: string;
  form: AppointmentForm;
  startsAt: string;
  durationMinutes: number;
  serviceId: string;
  serviceName: string;
  serviceCategoryColorHex?: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  roomId?: string;
  roomName?: string;
  status: AppointmentStatus;
  note?: string;
  /** Present only when Status is Cancelled (incl. a bulk no-show). */
  cancellationReason?: string;
  groupId?: string;
  /** Present only for Form=Group, when the group was loaded (e.g. GetByClient). */
  groupName?: string;
  recurrenceGroupId?: string;
  bookings: BookingDto[];
  warnings: WarningDto[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** One row of a specific client's appointment history (GET
 * /api/appointments/by-client/{clientId}) - deliberately does NOT carry the
 * other clients on the same appointment (privacy: a client's own history view
 * must not reveal who else was booked alongside them), so it is its own flat
 * DTO rather than AppointmentDto.bookings. Amount/PaidAmount/OutstandingAmount/
 * IsPaid/booking* fields are THIS client's own Booking, not shared with anyone
 * else on the same appointment. */
export interface ClientAppointmentHistoryDto {
  id: string;
  form: AppointmentForm;
  startsAt: string;
  durationMinutes: number;
  serviceId: string;
  serviceName: string;
  serviceCategoryColorHex?: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  /** Status of the occurrence itself (Scheduled/Completed/Cancelled) - see AppointmentStatus. */
  status: AppointmentStatus;
  groupId?: string;
  groupName?: string;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  isPaid: boolean;
  /** This client's own Booking id - never AppointmentDto.bookings (would reveal other clients). */
  bookingId: string;
  bookingStatus: BookingStatus;
  clientPackageId?: string;
  coverageType?: CoverageType;
  packageCoverageApplied: boolean;
  packageCoverageReturned: boolean;
  bookingNote?: string;
  /** Present only when bookingStatus is Cancelled/NoShow. */
  bookingCancellationReason?: string;
}

/** Query params for GET /api/appointments/schedule. `from`/`to` are required
 * DateTimeOffset strings (core/utils/date.util.ts) - everything else is an
 * optional filter, omitted from the request when unset. */
export interface AppointmentScheduleQuery {
  from: string;
  to: string;
  companyId?: string | null;
  employeeId?: string | null;
  serviceId?: string | null;
  executionMode?: ServiceExecutionMode | null;
  status?: AppointmentStatus | null;
  roomId?: string | null;
}

/** Body for PATCH /api/appointments/{id}/move - a dedicated partial-update
 * endpoint, deliberately NOT a full PUT. Sent by AppointmentDetailDialogComponent's
 * edit form. `startsAt`/`companyId` are always sent; `employeeId` is only
 * included when the dialog's `allowEmployeeChange` is set (grid A - see
 * ScheduleDayGridComponent - but not grid B's ScheduleWeekGridComponent, whose
 * trainer is already fixed by the grid). Every field left off this request is
 * left untouched server-side. */
export interface AppointmentMoveRequest {
  startsAt: string;
  employeeId?: string;
  companyId?: string;
  /** `undefined`/`null` = leave the room unchanged - it can NOT be used to
   * clear an already-assigned room, only to move to a different one (see
   * AppointmentDetailDialogComponent.onSave's doc comment). */
  roomId?: string | null;
  /** Bypasses soft (non-blocking-by-policy) work-hours blocks - EMPLOYEE_ABSENT/
   * EMPLOYEE_ON_BREAK/COMPANY_CLOSED_HOLIDAY/OUTSIDE_WORKING_HOURS - never
   * structural ones (inactive/invalid Company/Service/Employee/Room, an actual
   * double-booking). Ignored server-side unless the caller has
   * appointments.write.all. Only meaningful on the retry after the user
   * confirms a "Nastavi ipak?" prompt - omit/false on the first attempt. */
  overrideAvailability?: boolean;
}

/** Recurrence values exactly as the backend sends/accepts them. `Daily` = every
 * calendar day including weekends, `Weekly` = +7 days each occurrence. */
export type RecurrenceType = 'Daily' | 'Weekly';

const RECURRENCE_TYPE_TRANSLATION_KEYS: Record<RecurrenceType, string> = {
  Daily: 'SCHEDULE.RECURRENCE_TYPE.DAILY',
  Weekly: 'SCHEDULE.RECURRENCE_TYPE.WEEKLY',
};

export function recurrenceTypeTranslationKey(type: RecurrenceType): string {
  return RECURRENCE_TYPE_TRANSLATION_KEYS[type];
}

export const RECURRENCE_TYPES: RecurrenceType[] = ['Daily', 'Weekly'];

/** Billing for ONE client on a POST /schedule/complete or PATCH /{id}/complete
 * request (AppointmentClientSettlement) - AppointmentCompleteRequest.settlements
 * must cover every clientId exactly once, enabling mixed payment per client
 * (e.g. a duo: one by package, one by card). `clientPackageId` and
 * `paymentMethod` are mutually exclusive - when `clientPackageId` is set,
 * `paymentMethod` is ignored server-side (the package settles the booking,
 * no Payment row is created). When neither is set (and amount > 0), the
 * booking is recorded but stays financially unpaid (billed later). */
export interface AppointmentClientSettlement {
  clientId: string;
  /** Ignored if `clientPackageId` is set. `undefined` = not charged now (billed
   * later through the Checkout/Payment API). */
  paymentMethod?: PaymentMethod;
  /** Manual override of this client's suggested price. `undefined` = use the
   * price-list-resolved suggested price. */
  amount?: number;
  /** Package covering this booking - when set, `paymentMethod` is ignored. */
  clientPackageId?: string;
  /** Default true - only relevant when `paymentMethod` is set and
   * `clientPackageId` isn't: true records a real Payment for the full amount
   * immediately, false records the booking as outstanding (billed later). No
   * effect when `paymentMethod` is unset or the booking is package-covered. */
  isPaid: boolean;
}

/** Body for POST /api/appointments/schedule - creates a Scheduled, unbilled
 * appointment. `amount` null/omitted = backend resolves it from the price
 * list, same as PriceListService.resolve; the form only sends it when the
 * user manually overrides the suggested price. */
export interface AppointmentCreateRequest {
  startsAt: string;
  serviceId: string;
  employeeId: string;
  companyId: string;
  roomId?: string | null;
  clientIds: string[];
  amount?: number | null;
  note?: string | null;
  /** See AppointmentMoveRequest.overrideAvailability - same semantics. */
  overrideAvailability?: boolean;
}

/** Body for POST /api/appointments/complete (immediately billed, status
 * Completed) and PATCH /api/appointments/{id}/complete (bills an existing
 * Scheduled appointment) - identical shape for both. Must contain exactly one
 * AppointmentClientSettlement per clientId - see AppointmentClientSettlement's
 * doc. The inherited `amount` field is ignored here; each client has their own
 * `settlements[].amount`. */
export interface AppointmentCompleteRequest extends AppointmentCreateRequest {
  settlements: AppointmentClientSettlement[];
}

/** Body for POST /api/appointments/recurring. No `amount` field - every
 * generated instance uses its own resolved price, there is no immediate
 * billing for a recurring series (see RecurringAppointmentCreateRequest's
 * lack of a paymentMethod). */
export interface RecurringAppointmentCreateRequest {
  recurrenceType: RecurrenceType;
  serviceId: string;
  employeeId: string;
  companyId: string;
  roomId?: string | null;
  clientIds: string[];
  firstOccurrenceStartsAt: string;
  endDate: string;
  note?: string | null;
  /** See AppointmentMoveRequest.overrideAvailability - applied per occurrence. */
  overrideAvailability?: boolean;
}

/** Why one date in a POST /recurring request collided - see RecurringConflictDetail.
 * `OUTSIDE_WORKING_HOURS` (frontend #16) means the occurrence falls outside the
 * employee's or company's WorkingHoursTemplate - see core/models/working-hours.model.ts.
 * `EXISTING_SCHEDULE_BREAK` (frontend #22) means the occurrence collides with a
 * trainer's break - returned by both POST /appointments/recurring and POST
 * /schedule-breaks/recurring, the same reason list is shared by both series
 * endpoints. `ROOM_OCCUPIED` (Rooms) means the occurrence collides with an
 * existing booking in the chosen room - also returned by POST
 * /groups/generate when the group's defaultRoomId is already booked. */
export type RecurringConflictReason =
  | 'EXISTING_APPOINTMENT'
  | 'ROSTER_ABSENCE'
  | 'OUTSIDE_WORKING_HOURS'
  | 'EXISTING_SCHEDULE_BREAK'
  | 'ROOM_OCCUPIED';

const RECURRING_CONFLICT_REASON_TRANSLATION_KEYS: Record<RecurringConflictReason, string> = {
  EXISTING_APPOINTMENT: 'SCHEDULE.RECURRING_CONFLICT_REASONS.EXISTING_APPOINTMENT',
  ROSTER_ABSENCE: 'SCHEDULE.RECURRING_CONFLICT_REASONS.ROSTER_ABSENCE',
  OUTSIDE_WORKING_HOURS: 'SCHEDULE.RECURRING_CONFLICT_REASONS.OUTSIDE_WORKING_HOURS',
  EXISTING_SCHEDULE_BREAK: 'SCHEDULE.RECURRING_CONFLICT_REASONS.EXISTING_SCHEDULE_BREAK',
  ROOM_OCCUPIED: 'SCHEDULE.RECURRING_CONFLICT_REASONS.ROOM_OCCUPIED',
};

export function recurringConflictReasonTranslationKey(reason: RecurringConflictReason): string {
  return RECURRING_CONFLICT_REASON_TRANSLATION_KEYS[reason];
}

/** Body for both POST /{id}/cancel and POST /{id}/no-show - identical shape.
 * `returnEntryForClientIds` is an explicit opt-in list, not a blanket "return
 * everyone's entry" flag - clients left off keep their deducted entry
 * (silently no-op for a client who never had one deducted). */
export interface AppointmentCancelRequest {
  returnEntryForClientIds: string[];
  cancellationReason?: string | null;
}

/** Ad-hoc adding one client to an existing appointment (BookingCreateRequest) -
 * e.g. a guest/replacement on a group occurrence outside its member list. */
export interface BookingCreateRequest {
  clientId: string;
}

/** Cancel/no-show for ONE booking (BookingCancelRequest) - e.g. one of two
 * clients on a duo appointment - same shape as AppointmentCancelRequest minus
 * the client-list (always exactly one client, known from the route). */
export interface BookingCancelRequest {
  returnPackageEntry: boolean;
  cancellationReason?: string | null;
}

/** Booking status transition (BookingSetStatusRequest) - Confirmed to
 * Completed/Cancelled/NoShow, or (Group only, and only once a backend route
 * exposes it - see BookingStatus's doc) a reversal back to Confirmed. */
export interface BookingSetStatusRequest {
  status: BookingStatus;
  clientPackageId?: string;
  paymentMethod?: PaymentMethod;
  amount?: number;
  isPaid: boolean;
  note?: string | null;
  returnPackageEntry: boolean;
  cancellationReason?: string | null;
}

/** One free time range within GET /api/appointments/available-slots's per-employee
 * `slots` array (frontend #24) - TimeSpan strings ("HH:mm:ss"), same format as
 * WorkingHoursIntervalDto/AvailabilityIntervalDto. */
export interface AvailableSlotDto {
  start: string;
  end: string;
}

/** One entry of GET /api/appointments/available-slots's response array - one row
 * per employee qualified for the requested service at the requested company,
 * even when they have no free slots that day (`slots: []` - filter those out
 * client-side, see AvailableSlotsSliderComponent). Busyness is resolved across
 * ALL of the employee's companies, not just the requested one, so a trainer
 * working two companies never shows up free here when they're actually booked
 * at their other company. */
export interface EmployeeAvailableSlotsDto {
  employeeId: string;
  employeeName: string;
  colorHex: string | null;
  slots: AvailableSlotDto[];
}

/** GET /api/appointments/available-slots?serviceId=&companyId=&date=&employeeId=
 * (frontend #24, last item on the feature list) - `employeeId` is optional and
 * only used to narrow to one trainer (Member role locked to themselves via
 * CurrentEmployeeService); omitted, every qualified employee at the company is
 * returned. Powers NewAppointmentDialog's "slobodni termini" slider, a
 * time-saving shortcut that pre-fills the trainer/time fields - the manual
 * fields stay fully usable alongside it either way. */
export type AvailableSlotsResponseDto = EmployeeAvailableSlotsDto[];

/** One colliding date inside a 409 RECURRING_CONFLICT error's
 * `details.conflicts` array - see AppError.details (typed loosely as
 * Record<string, string[]> there since most error codes carry field-validation
 * lists; this endpoint's actual shape is read via a local cast where it's
 * consumed, see NewAppointmentDialogComponent). */
export interface RecurringConflictDetail {
  date: string;
  reason: RecurringConflictReason;
}
