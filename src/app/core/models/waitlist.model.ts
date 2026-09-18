/** Status of one WaitlistEntryDto row - see WaitlistEntryStatus.cs. `Waiting` is
 * the only non-terminal state; a seat freed by a real Confirmed→Cancelled
 * transition promotes the FIFO-first eligible Waiting entry server-side (see
 * WaitlistService.PromoteEligibleWaiters) - the frontend never picks who gets
 * promoted, only refetches after a cancellation to reveal the result. */
export type WaitlistEntryStatus = 'Waiting' | 'Promoted' | 'Cancelled' | 'Expired';

const WAITLIST_STATUS_TRANSLATION_KEYS: Record<WaitlistEntryStatus, string> = {
  Waiting: 'GROUPS.WAITLIST.STATUS.WAITING',
  Promoted: 'GROUPS.WAITLIST.STATUS.PROMOTED',
  Cancelled: 'GROUPS.WAITLIST.STATUS.CANCELLED',
  Expired: 'GROUPS.WAITLIST.STATUS.EXPIRED',
};

export function waitlistEntryStatusTranslationKey(status: WaitlistEntryStatus): string {
  return WAITLIST_STATUS_TRANSLATION_KEYS[status];
}

const WAITLIST_STATUS_SEVERITIES: Record<WaitlistEntryStatus, 'info' | 'success' | 'danger' | 'warn'> = {
  Waiting: 'info',
  Promoted: 'success',
  Cancelled: 'danger',
  Expired: 'warn',
};

export function waitlistEntryStatusSeverity(status: WaitlistEntryStatus): 'info' | 'success' | 'danger' | 'warn' {
  return WAITLIST_STATUS_SEVERITIES[status];
}

/** One row of GET/POST/DELETE .../waitlist (WaitlistEntryDto) - full history for
 * the occurrence, including terminal Promoted/Cancelled/Expired rows, not just
 * the active Waiting queue. `position` is only meaningful while `status` is
 * `Waiting` (1-based, FIFO by joinedAt) - null otherwise, and it is a derived
 * read value, never sent by the frontend. */
export interface WaitlistEntryDto {
  id: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  status: WaitlistEntryStatus;
  position?: number;
  joinedAt: string;
  promotedAt?: string;
  /** Set only when status is Promoted - the Booking the promotion created. */
  promotedBookingId?: string;
  cancelledAt?: string;
  /** Set only when status is Expired - CLIENT_INACTIVE/CLIENT_ANONYMIZED/
   * CLIENT_SCHEDULE_CONFLICT/APPOINTMENT_NO_LONGER_AVAILABLE/
   * APPOINTMENT_CANCELLED/APPOINTMENT_COMPLETED (WaitlistExpiredReasons.cs) -
   * treated as an opaque code, no frontend branching on its value beyond i18n. */
  expiredReason?: string;
}

/** Body for POST /api/appointments/{appointmentId}/waitlist. Only allowed when
 * the occurrence is actually full (409 CAPACITY_AVAILABLE otherwise). */
export interface WaitlistJoinRequest {
  clientId: string;
}
