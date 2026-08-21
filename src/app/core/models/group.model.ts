/** Day-of-week values exactly as the backend sends/accepts them (standard .NET
 * enum string, English). Use these everywhere in logic - translate only for
 * display. */
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

const DAY_OF_WEEK_TRANSLATION_KEYS: Record<DayOfWeek, string> = {
  Monday: 'GROUPS.DAYS.MONDAY',
  Tuesday: 'GROUPS.DAYS.TUESDAY',
  Wednesday: 'GROUPS.DAYS.WEDNESDAY',
  Thursday: 'GROUPS.DAYS.THURSDAY',
  Friday: 'GROUPS.DAYS.FRIDAY',
  Saturday: 'GROUPS.DAYS.SATURDAY',
  Sunday: 'GROUPS.DAYS.SUNDAY',
};

export function dayOfWeekTranslationKey(day: DayOfWeek): string {
  return DAY_OF_WEEK_TRANSLATION_KEYS[day];
}

const DAY_OF_WEEK_SHORT_TRANSLATION_KEYS: Record<DayOfWeek, string> = {
  Monday: 'GROUPS.DAYS_SHORT.MONDAY',
  Tuesday: 'GROUPS.DAYS_SHORT.TUESDAY',
  Wednesday: 'GROUPS.DAYS_SHORT.WEDNESDAY',
  Thursday: 'GROUPS.DAYS_SHORT.THURSDAY',
  Friday: 'GROUPS.DAYS_SHORT.FRIDAY',
  Saturday: 'GROUPS.DAYS_SHORT.SATURDAY',
  Sunday: 'GROUPS.DAYS_SHORT.SUNDAY',
};

/** Short form ("Pon", "Uto"...) - used by the groups list's slots summary
 * column, where the full day name would be too wide. */
export function dayOfWeekShortTranslationKey(day: DayOfWeek): string {
  return DAY_OF_WEEK_SHORT_TRANSLATION_KEYS[day];
}

/** Display order for building day-of-week Select options (week starts Monday). */
export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** One weekly recurrence slot of a group, as returned by GET and by the slot
 * endpoints (which return the whole GroupDto, not just the slot). `startTime`
 * is a TimeSpan string ("HH:mm:ss") - there is no endTime, duration is derived
 * from the group's service only when appointments are generated. */
export interface GroupSlotDto {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  isActive: boolean;
}

/** Body for POST /api/groups/{id}/slots and PUT /api/groups/{id}/slots/{slotId} -
 * identical shape. */
export interface GroupSlotRequest {
  dayOfWeek: DayOfWeek;
  startTime: string;
}

/** One active or past membership row, as returned inside GroupDetailDto.members.
 * `joinedAt` is kept across a leave/rejoin - rejoining always inserts a new row
 * rather than reactivating an old one (see GroupsService.addMember). */
export interface GroupMemberDto {
  id: string;
  clientId: string;
  clientName: string;
  joinedAt: string;
  isActive: boolean;
}

/**
 * Minimal subset of the schedule grid's appointment cell needed by the group
 * detail page's "nadolazeći/prošli termini" lists. The full shape belongs to
 * Raspored (frontend #8, not yet built) - only the fields this screen actually
 * renders are declared here; extend once that module lands.
 */
export interface GroupAppointmentCellDto {
  id: string;
  date: string;
  startTime: string;
  companyName: string;
  trainerName: string | null;
  expectedCount: number;
  attendanceCount: number;
}

/** GET /api/groups/{id} (and the flat list of GET /api/groups). `warnings` is
 * transient - only ever populated in the response of POST .../members when
 * adding a member pushes the group over capacity, never on a plain GET. */
export interface GroupDto {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  companyId: string;
  companyName: string;
  capacity: number;
  defaultTrainerId: string | null;
  defaultTrainerName: string | null;
  isActive: boolean;
  note: string | null;
  slots: GroupSlotDto[];
  activeMemberCount: number;
  warnings: string[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** GET /api/groups/{id} - the detail response, a superset of GroupDto.
 * `upcomingAppointments`/`pastAppointments` cover a -3/+3 month window and are
 * already-resolved rows, no extra call needed. */
export interface GroupDetailDto extends GroupDto {
  members: GroupMemberDto[];
  upcomingAppointments: GroupAppointmentCellDto[];
  pastAppointments: GroupAppointmentCellDto[];
}

/** Body for POST /api/groups. `slots` is required here (min 1) - once created,
 * slots are managed exclusively through the /slots endpoints (see
 * GroupUpdateRequest, which has no slots field at all). */
export interface GroupCreateRequest {
  name: string;
  serviceId: string;
  companyId: string;
  capacity: number;
  defaultTrainerId: string | null;
  note: string | null;
  slots: GroupSlotRequest[];
}

/** Body for PUT /api/groups/{id}. Deliberately does NOT include slots or
 * members - those are managed through their own endpoints. Activation is a
 * separate PATCH, not part of this body either. */
export interface GroupUpdateRequest {
  name: string;
  serviceId: string;
  companyId: string;
  capacity: number;
  defaultTrainerId: string | null;
  note: string | null;
}

/** Body for POST /api/groups/generate-appointments. `groupId` null generates for
 * all active groups. Idempotent - a repeat call for the same range is safe and
 * returns createdCount: 0 with everything counted as skipped. */
export interface GenerateGroupAppointmentsRequest {
  groupId: string | null;
  fromDate: string;
  toDate: string;
}

export interface GenerateGroupAppointmentsResult {
  createdCount: number;
  skippedCount: number;
  created: GroupAppointmentCellDto[];
}
