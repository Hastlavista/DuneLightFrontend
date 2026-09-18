import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';
import { AppointmentScheduleCellDto } from '../../../../../core/models/appointment.model';
import { DAYS_OF_WEEK, DayOfWeek, GroupDto, GroupSlotDto, dayOfWeekTranslationKey } from '../../../../../core/models/group.model';
import { RoomDto } from '../../../../../core/models/room.model';
import { AvailabilityService } from '../../../../../core/services/availability.service';
import { AppointmentsService } from '../../../../../core/services/appointments.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { GroupsService } from '../../../../../core/services/groups.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { RoomsService } from '../../../../../core/services/rooms.service';
import { ServicesService } from '../../../../../core/services/services.service';
import { toDateOnly, toLocalIsoFromDate } from '../../../../../core/utils/date.util';
import { isOutsideAvailability, isRoomOccupied, nextOccurrenceDate } from '../../../../../core/utils/scheduling-conflict.util';
import { parseTimeOfDay, toTimeOfDayString } from '../../../../../core/utils/time-of-day.util';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { resolveWarningMessage } from '../../../../../core/utils/warning-translation.util';

interface DayOption {
  label: string;
  value: DayOfWeek;
}

/** Add/edit a single slot - POST/PUT .../slots(/{slotId}), each returning the
 * whole GroupDto (see GroupsService). The parent section refetches the full
 * group detail on `saved` rather than trying to reconcile that partial
 * response itself. */
@Component({
  selector: 'app-group-slot-form-dialog',
  imports: [Dialog, ReactiveFormsModule, Select, DatePicker, Button, TranslatePipe],
  templateUrl: './group-slot-form-dialog.component.html',
})
export class GroupSlotFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly groupsService = inject(GroupsService);
  private readonly availabilityService = inject(AvailabilityService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly roomsService = inject(RoomsService);
  private readonly servicesService = inject(ServicesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly groupId = input.required<string>();
  /** Default trainer/room + service/company, used only by the pre-save
   * working-hours/room-occupancy warning below - see checkSchedulingWarnings. */
  readonly group = input<GroupDto | null>(null);
  readonly slot = input<GroupSlotDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);
  readonly isEditMode = signal(false);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly dayOptions = computed<DayOption[]>(() => {
    this.translationsReady();
    return DAYS_OF_WEEK.map((day) => ({ label: this.translate.instant(dayOfWeekTranslationKey(day)), value: day }));
  });

  readonly form = this.fb.nonNullable.group({
    dayOfWeek: this.fb.nonNullable.control<DayOfWeek>('Monday', Validators.required),
    startTime: this.fb.control<Date | null>(null, Validators.required),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        const slot = this.slot();
        this.isEditMode.set(slot !== null);
        this.form.reset({
          dayOfWeek: slot?.dayOfWeek ?? 'Monday',
          startTime: slot?.startTime ? parseTimeOfDay(slot.startTime) : null,
        });
      } else {
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (!raw.startTime) {
      this.form.controls.startTime.markAsTouched();
      return;
    }

    this.checkSchedulingWarnings(raw.dayOfWeek, raw.startTime).subscribe((reasons) => {
      if (reasons.length === 0) {
        this.saveSlot();
        return;
      }
      this.confirmationService.confirm({
        header: this.translate.instant('SCHEDULING_WARNINGS.CONFIRM_HEADER'),
        message: `${reasons.join(' ')} ${this.translate.instant('SCHEDULING_WARNINGS.CONFIRM_MESSAGE')}`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: this.translate.instant('SCHEDULING_WARNINGS.CONTINUE_ANYWAY'),
        rejectLabel: this.translate.instant('COMMON.CANCEL'),
        acceptButtonProps: { severity: 'warn' },
        accept: () => this.saveSlot(),
      });
    });
  }

  private saveSlot(): void {
    const raw = this.form.getRawValue();
    if (!raw.startTime) {
      return;
    }
    const request = { dayOfWeek: raw.dayOfWeek, startTime: toTimeOfDayString(raw.startTime) };
    const slot = this.slot();

    this.saving.set(true);
    const request$ = slot
      ? this.groupsService.updateSlot(this.groupId(), slot.id, request)
      : this.groupsService.addSlot(this.groupId(), request);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (updated) => {
        this.notifications.showSuccess(this.translate.instant(slot ? 'GROUPS.SLOTS.UPDATED' : 'GROUPS.SLOTS.ADDED'));
        for (const warning of updated.warnings) {
          this.notifications.showWarning(resolveWarningMessage(this.translate, warning));
        }
        this.visible.set(false);
        this.saved.emit();
      },
      error: () => {},
    });
  }

  /** Soft (non-blocking) pre-save check (frontend #27) - a GroupSlotDto only
   * carries dayOfWeek + startTime, no concrete date, so the group's default
   * trainer/room are checked against the next upcoming occurrence of that
   * weekday (see nextOccurrenceDate's doc). Skips entirely when the group has
   * neither a default trainer nor a default room set. */
  private checkSchedulingWarnings(dayOfWeek: DayOfWeek, startTime: Date) {
    const group = this.group();
    if (!group || (!group.defaultTrainerId && !group.defaultRoomId)) {
      return of<string[]>([]);
    }

    const occurrence = nextOccurrenceDate(dayOfWeek);
    const candidateStart = new Date(
      occurrence.getFullYear(),
      occurrence.getMonth(),
      occurrence.getDate(),
      startTime.getHours(),
      startTime.getMinutes(),
      0,
      0,
    );
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();

    const trainerCheck$ = group.defaultTrainerId
      ? this.availabilityService
          .get({ employeeId: group.defaultTrainerId, companyId: group.companyId, date: toDateOnly(occurrence) }, { suppressErrorToast: true })
          .pipe(catchError(() => of(null)))
      : of(null);

    const roomCheck$: Observable<{ room: RoomDto | null; durationMinutes: number; appointments: AppointmentScheduleCellDto[] } | null> =
      group.defaultRoomId
        ? forkJoin({
            room: this.roomsService.getById(group.defaultRoomId).pipe(catchError(() => of(null))),
            service: this.servicesService.getById(group.serviceId).pipe(catchError(() => of(null))),
            schedule: this.appointmentsService
              .getSchedule(
                {
                  from: toLocalIsoFromDate(new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate(), 0, 0, 0, 0)),
                  to: toLocalIsoFromDate(new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate(), 23, 59, 59, 999)),
                  companyId: group.companyId,
                  roomId: group.defaultRoomId,
                },
                { suppressErrorToast: true },
              )
              .pipe(catchError(() => of({ appointments: [], breaks: [] }))),
          }).pipe(
            map(({ room, service, schedule }) => ({
              room,
              durationMinutes: service?.defaultDurationMinutes ?? 60,
              appointments: schedule.appointments,
            })),
          )
        : of(null);

    return forkJoin({ availability: trainerCheck$, room: roomCheck$ }).pipe(
      map(({ availability, room }) => {
        const reasons: string[] = [];
        if (availability && isOutsideAvailability(startMinutes, startMinutes, availability.effectiveIntervals)) {
          reasons.push(this.translate.instant('SCHEDULING_WARNINGS.TRAINER_OUTSIDE_HOURS', { name: group.defaultTrainerName ?? '' }));
        }
        if (room?.room && !room.room.allowConcurrentBookings && isRoomOccupied(candidateStart, room.durationMinutes, room.appointments)) {
          reasons.push(this.translate.instant('SCHEDULING_WARNINGS.ROOM_UNAVAILABLE'));
        }
        return reasons;
      }),
    );
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
