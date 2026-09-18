import { TranslateService } from '@ngx-translate/core';
import { AppointmentScheduleCellDto } from '../../../core/models/appointment.model';
import { GroupAppointmentCellDto } from '../../../core/models/group.model';
import { ScheduleBreakCellDto } from '../../../core/models/schedule-break.model';
import { localDateKey } from './schedule-date.util';
import { ScheduleGridCell } from './schedule-grid.models';

const DEFAULT_COLOR_HEX = '#C1A5A9';
/** Neutral, not-a-service-category color for a break cell's border/tint -
 * deliberately not any real category color, see toScheduleBreakGridCell. */
const BREAK_COLOR_HEX = '#7A5D61';

/** Maps one flat schedule row (AppointmentScheduleCellDto) into the grid's
 * generic cell view model. `columnId` is resolved by the caller since it means
 * different things per grid (employeeId for grid A, a local date key for grid
 * B - see ScheduleDayGridComponent/ScheduleWeekGridComponent). Callers must
 * filter out `Cancelled` rows before calling this - a cancelled appointment
 * frees its slot and should render as empty grid space, not a cell; see each
 * caller's `gridCells` computed.
 *
 * `noShow` is always false (see the field's own comment below) - kept on the
 * cell model for when the feed eventually carries per-booking status.
 *
 * Individual appointments show the (first) client name, "+N" when there are
 * more. Group appointments (form === 'Group' - not returned by any endpoint
 * yet, but rendering already accounts for it) show the group name instead,
 * plus occupancy: "6/8" for upcoming, "6 prisutnih" for past ones, since
 * `expectedCount` is the group's *current* member count, not a historical
 * snapshot - showing it against a past attendanceCount would be misleading.
 *
 * `birthdayDateByClientId` (clientId -> local date key, see
 * buildBirthdayLookup) drives the birthday marker: true only when one of this
 * appointment's clients has a birthday that lands exactly on the
 * appointment's own calendar date. Matched by id, not name, and by
 * `dto.clientIds` specifically (not `clientNames`) - the backend doesn't send
 * `clientIds` yet, so this is always false until it does; see
 * AppointmentScheduleCellDto.clientIds. */
export function toScheduleGridCell(
  dto: AppointmentScheduleCellDto,
  columnId: string,
  companyColorHex: string | null | undefined,
  translate: TranslateService,
  birthdayDateByClientId: ReadonlyMap<string, string> = new Map(),
): ScheduleGridCell {
  const startsAt = new Date(dto.startsAt);
  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const isPast = startsAt.getTime() < Date.now();
  const isGroup = dto.form === 'Group';
  const appointmentDateKey = localDateKey(startsAt);
  const hasBirthday = (dto.clientIds ?? []).some((clientId) => birthdayDateByClientId.get(clientId) === appointmentDateKey);

  let title: string;
  if (isGroup) {
    const occupancy = isPast
      ? translate.instant('SCHEDULE.CELL.ATTENDANCE_PAST', { count: dto.attendanceCount ?? 0 })
      : `${dto.attendanceCount ?? 0}/${dto.expectedCount ?? 0}`;
    title = `${dto.groupName ?? ''} · ${occupancy}`;
  } else if (dto.clientNames.length > 1) {
    title = `${dto.clientNames[0]} ${translate.instant('SCHEDULE.CELL.PLUS_MORE', { count: dto.clientNames.length - 1 })}`;
  } else {
    title = dto.clientNames[0] ?? '';
  }

  return {
    id: dto.id,
    columnId,
    kind: 'appointment',
    startMinutes,
    durationMinutes: dto.durationMinutes,
    colorHex: dto.serviceCategoryColorHex ?? DEFAULT_COLOR_HEX,
    companyColorHex,
    title,
    subtitle: dto.serviceName,
    roomName: dto.roomName,
    // An Appointment (occurrence) can never itself be NoShow - only a Booking
    // (per-client) can, see AppointmentStatus's doc. The lightweight schedule
    // feed doesn't carry per-booking status, so there is currently no signal
    // to render this from; always false until the feed is enriched.
    noShow: false,
    status: dto.status,
    hasBirthday,
    source: dto,
  };
}

/** Maps one break row (ScheduleBreakCellDto, the feed's lightweight shape -
 * see its doc comment) into the grid's generic cell view model - same role as
 * toScheduleGridCell() but for a break, which has no service/client/status of
 * its own. `title` is always the generic "Pauza" label (translated);
 * `subtitle` is the break's own note, if any. */
export function toScheduleBreakGridCell(
  dto: ScheduleBreakCellDto,
  columnId: string,
  companyColorHex: string | null | undefined,
  translate: TranslateService,
): ScheduleGridCell {
  const startsAt = new Date(dto.startsAt);
  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();

  return {
    id: dto.id,
    columnId,
    kind: 'break',
    startMinutes,
    durationMinutes: dto.durationMinutes,
    colorHex: BREAK_COLOR_HEX,
    companyColorHex,
    title: translate.instant('SCHEDULE.BREAK.LABEL'),
    subtitle: dto.note ?? '',
    noShow: false,
    hasBirthday: false,
    source: dto,
  };
}

/** Adapts a group appointment's flat schedule row into the
 * GroupAppointmentCellDto shape GroupAttendanceDialogComponent expects -
 * lets the schedule grids reuse that dialog (from the Grupe module) without
 * a separate schedule-specific attendance endpoint. */
export function toGroupAppointmentCell(dto: AppointmentScheduleCellDto): GroupAppointmentCellDto {
  return {
    id: dto.id,
    startsAt: dto.startsAt,
    companyName: dto.companyName,
    employeeName: dto.employeeName,
    expectedCount: dto.expectedCount ?? 0,
    attendanceCount: dto.attendanceCount ?? 0,
    status: dto.status,
  };
}
