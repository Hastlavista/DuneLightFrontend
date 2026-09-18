import type { PaymentMethod } from './appointment.model';

/** How a recorded attendance row was paid for - decided server-side (see
 * SetGroupAttendanceRequest), never sent by the frontend directly except when
 * disambiguating via clientPackageId. Use these everywhere in logic - never a
 * display label. */
export type CoverageType = 'MonthlyPackage' | 'SessionPackage' | 'SinglePaid';

const COVERAGE_TYPE_TRANSLATION_KEYS: Record<CoverageType, string> = {
  MonthlyPackage: 'GROUPS.ATTENDANCE.COVERAGE.MONTHLY_PACKAGE',
  SessionPackage: 'GROUPS.ATTENDANCE.COVERAGE.SESSION_PACKAGE',
  SinglePaid: 'GROUPS.ATTENDANCE.COVERAGE.SINGLE_PAID',
};

export function coverageTypeTranslationKey(coverageType: CoverageType): string {
  return COVERAGE_TYPE_TRANSLATION_KEYS[coverageType];
}

/** One row of GET .../attendance - either an active member without a recorded
 * visit yet (in `expected`) or anyone with one, member or guest (in `recorded`).
 * Fields beyond clientId/clientName/isMember are only ever populated on a
 * `recorded` row. Booking-level commercial state (amount/paidAmount/
 * outstandingAmount/isPaid) is 0/false until the booking is checked in - see
 * GroupAttendanceEntryDto's doc. */
export interface AttendanceEntry {
  clientId: string;
  clientName: string;
  attended?: boolean;
  coverageType?: CoverageType;
  clientPackageId?: string;
  packageCoverageApplied?: boolean;
  packageCoverageReturned?: boolean;
  amount?: number;
  suggestedAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  isPaid?: boolean;
  note?: string;
  isMember: boolean;
}

/** GET /api/groups/appointments/{appointmentId}/attendance. */
export interface GroupAttendanceListDto {
  expected: AttendanceEntry[];
  recorded: AttendanceEntry[];
}

/** Body for POST /api/groups/appointments/{appointmentId}/attendance - always
 * one client per call. `clientPackageId` must be supplied when the client has
 * more than one eligible package (VALIDATION_ERROR otherwise); omit it
 * otherwise and let the backend resolve coverage. Setting `attended: false` on
 * a row that had a SessionPackage deduction automatically returns the entry -
 * no separate "return entry?" prompt, unlike individual appointments.
 * `paymentMethod`/`amount`/`isPaid` only matter when `attended: true` and
 * coverage isn't a package (SinglePaid - i.e. the client has no eligible
 * package for this service) - omitted `paymentMethod` = recorded without
 * charging now (billed later), same semantics as
 * AppointmentClientSettlement/BookingSetStatusRequest. */
export interface SetGroupAttendanceRequest {
  clientId: string;
  attended: boolean;
  clientPackageId: string | null;
  paymentMethod?: PaymentMethod;
  amount?: number;
  isPaid?: boolean;
  note: string | null;
}
