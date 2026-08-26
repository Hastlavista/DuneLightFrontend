import { CoverageType } from './group-attendance.model';
import { ServiceExecutionMode } from './service.model';

/** Status values exactly as the backend sends/accepts them. Use these
 * everywhere in logic - never a display label. */
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow';

const STATUS_TRANSLATION_KEYS: Record<AppointmentStatus, string> = {
  Scheduled: 'SCHEDULE.STATUS.SCHEDULED',
  Completed: 'SCHEDULE.STATUS.COMPLETED',
  Cancelled: 'SCHEDULE.STATUS.CANCELLED',
  NoShow: 'SCHEDULE.STATUS.NO_SHOW',
};

export function appointmentStatusTranslationKey(status: AppointmentStatus): string {
  return STATUS_TRANSLATION_KEYS[status];
}

/** Display order for the status filter dropdown. */
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['Scheduled', 'Completed', 'Cancelled', 'NoShow'];

const STATUS_SEVERITIES: Record<AppointmentStatus, 'info' | 'success' | 'danger' | 'warn'> = {
  Scheduled: 'info',
  Completed: 'success',
  Cancelled: 'danger',
  NoShow: 'warn',
};

export function appointmentStatusSeverity(status: AppointmentStatus): 'info' | 'success' | 'danger' | 'warn' {
  return STATUS_SEVERITIES[status];
}

/** Every appointment is currently `Individual` - no endpoint returns
 * `Form: 'Group'` yet (group termini arrive with the Grupe module wiring, not
 * built here). Modeled now so the schedule grid's cell rendering and click
 * routing can branch on it without a later rewrite. */
export type AppointmentForm = 'Individual' | 'Group';

/** GET /api/appointments/schedule - one entry of `ScheduleFeedDto.appointments`
 * (frontend #22 - the endpoint used to return this as a bare flat array; see
 * ScheduleFeedDto in core/models/schedule-break.model.ts for the current
 * envelope). Backend omits null/absent fields from the JSON entirely rather
 * than sending an explicit null (see core/utils/date.util.ts's
 * PlusSafeUrlCodec note for the same convention elsewhere) - fields that can
 * be absent are typed with `?`, never `| null`. `form`/`groupName`/
 * `attendanceCount`/`expectedCount` are forward-looking - always absent today
 * since every appointment is Individual, but the schedule grid already
 * renders them when present. */
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
  clientNames: string[];
  /** Index-aligned with `clientNames` - NOT sent by the backend yet (requested
   * for the birthday marker in schedule-cell-view.util.ts, which needs a
   * reliable id to match against GET /api/clients/birthdays instead of
   * matching on name, since two clients can share a name). Frontend treats
   * this as absent until the backend adds it - see toScheduleGridCell. */
  clientIds?: string[];
  status: AppointmentStatus;
  isCancelled: boolean;
  form?: AppointmentForm;
  groupId?: string;
  groupName?: string;
  attendanceCount?: number;
  expectedCount?: number;
}

/** One client on a full AppointmentDto - just enough to render the read-only
 * detail panel's client list, not a full ClientDto. `packageEntryDeducted`/
 * `packageEntryReturned` are the actual per-client state (not derived from any
 * appointment-level payment field - price/isPaid/clientPackageId stay single
 * values for the whole appointment, see AppointmentDto) - cancel/no-show only
 * offers a "vrati ulazak" checkbox for a client where an entry was deducted
 * and not already returned, which also correctly covers the rare mixed state
 * left behind by multiple PATCH .../complete calls on the same appointment. */
export interface AppointmentClientRef {
  clientId: string;
  clientName: string;
  packageEntryDeducted: boolean;
  packageEntryReturned: boolean;
}

/** Attendance/coverage of ONE client on ONE group appointment - see
 * AppointmentDto.clientAttendance. Only ever populated by GET .../by-client for
 * a Form=Group row, and only when that client has a recorded attendance/absence
 * on it (never present for an individual appointment, or a group appointment
 * this client hasn't been checked in/out on yet). */
export interface ClientAttendanceDto {
  attended?: boolean;
  coverageType?: CoverageType;
  clientPackageId?: string;
}

/** GET /api/appointments/{id} and the body PATCH /{id}/move responds with (see
 * AppointmentsService.move). A superset of AppointmentScheduleCellDto's fields
 * plus price/payment/note/recurrence - the price/payment shape here is a single
 * total for the whole appointment (not per-client), confirmed as the intended
 * contract even though multiple clients can share one individual appointment.
 * `warnings` is transient - only ever populated on the move (and later
 * create/complete/update) response, always empty on a plain GET. */
export interface AppointmentDto {
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
  status: AppointmentStatus;
  isCancelled: boolean;
  form?: AppointmentForm;
  groupId?: string;
  groupName?: string;
  attendanceCount?: number;
  expectedCount?: number;
  clients: AppointmentClientRef[];
  amount: number;
  isPaid: boolean;
  paymentMethod?: PaymentMethod;
  clientPackageId?: string;
  note?: string;
  recurrenceGroupId?: string;
  /** Only ever populated by GET .../by-client for a Form=Group row where this
   * client has a recorded attendance/absence - see ClientAttendanceDto. */
  clientAttendance?: ClientAttendanceDto;
  warnings: string[];
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
}

/** Payment method values exactly as the backend sends/accepts them. */
export type PaymentMethod = 'Cash' | 'Card' | 'BankTransfer' | 'Package';

const PAYMENT_METHOD_TRANSLATION_KEYS: Record<PaymentMethod, string> = {
  Cash: 'SCHEDULE.PAYMENT_METHOD.CASH',
  Card: 'SCHEDULE.PAYMENT_METHOD.CARD',
  BankTransfer: 'SCHEDULE.PAYMENT_METHOD.BANK_TRANSFER',
  Package: 'SCHEDULE.PAYMENT_METHOD.PACKAGE',
};

export function paymentMethodTranslationKey(method: PaymentMethod): string {
  return PAYMENT_METHOD_TRANSLATION_KEYS[method];
}

/** Display order for the payment method select. */
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'BankTransfer', 'Package'];

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

/** One client's chosen sold package for a Package-paid POST /schedule/complete
 * (or PATCH /{id}/complete) request - `clientIds`/`packageSelections` must
 * cover each other 1:1 (every client exactly once) whenever paymentMethod is
 * `Package`, enforced server-side. */
export interface PackageSelection {
  clientId: string;
  clientPackageId: string;
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
  clientIds: string[];
  amount?: number | null;
  note?: string | null;
}

/** Body for POST /api/appointments/schedule/complete (immediately billed, status
 * Completed) and PATCH /api/appointments/{id}/complete (bills an existing
 * Scheduled appointment) - identical shape for both. `packageSelections` is
 * only meaningful (and required to cover every clientId) when paymentMethod is
 * `Package` - send an empty array for any other method. */
export interface AppointmentCompleteRequest extends AppointmentCreateRequest {
  paymentMethod: PaymentMethod;
  packageSelections: PackageSelection[];
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
  clientIds: string[];
  firstOccurrenceStartsAt: string;
  endDate: string;
  note?: string | null;
}

/** Body for both POST /{id}/cancel and POST /{id}/no-show - identical shape.
 * `returnEntryForClientIds` is an explicit opt-in list, not a blanket "return
 * everyone's entry" flag - clients left off keep their deducted entry
 * (silently no-op for a client who never had one deducted). */
export interface AppointmentCancelRequest {
  returnEntryForClientIds: string[];
}

/** Why one date in a POST /recurring request collided - see RecurringConflictDetail.
 * `OUTSIDE_WORKING_HOURS` (frontend #16) means the occurrence falls outside the
 * employee's or location's WorkingHoursTemplate - see core/models/working-hours.model.ts.
 * `EXISTING_SCHEDULE_BREAK` (frontend #22) means the occurrence collides with a
 * trainer's break - returned by both POST /appointments/recurring and POST
 * /schedule-breaks/recurring, the same reason list is shared by both series
 * endpoints. */
export type RecurringConflictReason =
  'EXISTING_APPOINTMENT' | 'ROSTER_ABSENCE' | 'OUTSIDE_WORKING_HOURS' | 'EXISTING_SCHEDULE_BREAK';

const RECURRING_CONFLICT_REASON_TRANSLATION_KEYS: Record<RecurringConflictReason, string> = {
  EXISTING_APPOINTMENT: 'SCHEDULE.RECURRING_CONFLICT_REASONS.EXISTING_APPOINTMENT',
  ROSTER_ABSENCE: 'SCHEDULE.RECURRING_CONFLICT_REASONS.ROSTER_ABSENCE',
  OUTSIDE_WORKING_HOURS: 'SCHEDULE.RECURRING_CONFLICT_REASONS.OUTSIDE_WORKING_HOURS',
  EXISTING_SCHEDULE_BREAK: 'SCHEDULE.RECURRING_CONFLICT_REASONS.EXISTING_SCHEDULE_BREAK',
};

export function recurringConflictReasonTranslationKey(reason: RecurringConflictReason): string {
  return RECURRING_CONFLICT_REASON_TRANSLATION_KEYS[reason];
}

/** One free time range within GET /api/appointments/available-slots's per-employee
 * `slots` array (frontend #24) - TimeSpan strings ("HH:mm:ss"), same format as
 * WorkingHoursIntervalDto/AvailabilityIntervalDto. */
export interface AvailableSlotDto {
  start: string;
  end: string;
}

/** One entry of GET /api/appointments/available-slots's response array - one row
 * per employee qualified for the requested service at the requested location,
 * even when they have no free slots that day (`slots: []` - filter those out
 * client-side, see AvailableSlotsSliderComponent). Busyness is resolved across
 * ALL of the employee's locations, not just the requested one, so a trainer
 * working two locations never shows up free here when they're actually booked
 * at their other location. */
export interface EmployeeAvailableSlotsDto {
  employeeId: string;
  employeeName: string;
  colorHex: string | null;
  slots: AvailableSlotDto[];
}

/** GET /api/appointments/available-slots?serviceId=&companyId=&date=&employeeId=
 * (frontend #24, last item on the feature list) - `employeeId` is optional and
 * only used to narrow to one trainer (Member role locked to themselves via
 * CurrentEmployeeService); omitted, every qualified employee at the location is
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
