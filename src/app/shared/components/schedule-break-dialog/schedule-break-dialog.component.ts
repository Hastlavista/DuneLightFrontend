import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { ScheduleBreakDto, ScheduleBreakUpdateRequest } from '../../../core/models/schedule-break.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ScheduleBreaksService } from '../../../core/services/schedule-breaks.service';
import { toLocalIsoFromDate } from '../../../core/utils/date.util';

/**
 * View/edit/delete for a single existing break (frontend #22) - deliberately
 * NOT AppointmentDetailDialogComponent, which assumes a service/clients/price
 * a break never has. Given only `breakId` (from the grid's ScheduleBreakCellDto
 * click - see ScheduleDayGridComponent/ScheduleWeekGridComponent's
 * `breakClicked`) and fetches the full ScheduleBreakDto itself via GET
 * /schedule-breaks/{id} before showing the edit form - the same
 * light-cell-click -> GetById -> full-detail-dialog pattern
 * AppointmentDetailDialogComponent uses for termini. Never edits straight off
 * the feed's lightweight ScheduleBreakCellDto, which lacks
 * `recurrenceGroupId`.
 *
 * Trainer/location are shown read-only (this simple dialog never moves a
 * break to a different trainer/location, only its time/duration/note) -
 * PUT still resends them unchanged since the endpoint is a full replace.
 *
 * Delete is a real delete (no "trag ostaje" note like cancelling a termin) -
 * just a plain "Sigurno obrisati pauzu?" confirm.
 */
@Component({
  selector: 'app-schedule-break-dialog',
  imports: [Dialog, ReactiveFormsModule, DatePicker, InputNumber, Textarea, Button, TranslatePipe],
  templateUrl: './schedule-break-dialog.component.html',
  styleUrl: './schedule-break-dialog.component.scss',
})
export class ScheduleBreakDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly scheduleBreaksService = inject(ScheduleBreaksService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly breakId = input<string | null>(null);

  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly scheduleBreak = signal<ScheduleBreakDto | null>(null);

  readonly form = this.fb.nonNullable.group({
    startsAt: this.fb.control<Date | null>(null, Validators.required),
    durationMinutes: this.fb.nonNullable.control<number>(1, [Validators.required, Validators.min(1)]),
    note: this.fb.nonNullable.control<string>(''),
  });

  constructor() {
    effect(() => {
      const id = this.breakId();
      if (this.visible() && id) {
        this.fetch(id);
      } else if (!this.visible()) {
        this.scheduleBreak.set(null);
        this.form.reset({ startsAt: null, durationMinutes: 1, note: '' });
      }
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSave(): void {
    const dto = this.scheduleBreak();
    if (!dto || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: ScheduleBreakUpdateRequest = {
      employeeId: dto.employeeId,
      companyId: dto.companyId,
      startsAt: toLocalIsoFromDate(raw.startsAt as Date),
      durationMinutes: raw.durationMinutes,
      note: raw.note || null,
    };

    this.saving.set(true);
    this.scheduleBreaksService
      .update(dto.id, request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('SCHEDULE.BREAK.DIALOG.UPDATED'));
          this.visible.set(false);
          this.saved.emit();
        },
        error: () => {},
      });
  }

  onDelete(): void {
    const dto = this.scheduleBreak();
    if (!dto) {
      return;
    }
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('SCHEDULE.BREAK.DIALOG.CONFIRM_DELETE'),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.deleting.set(true);
        this.scheduleBreaksService
          .delete(dto.id)
          .pipe(finalize(() => this.deleting.set(false)))
          .subscribe({
            next: () => {
              this.notifications.showSuccess(this.translate.instant('SCHEDULE.BREAK.DIALOG.DELETED'));
              this.visible.set(false);
              this.saved.emit();
            },
            error: () => {},
          });
      },
    });
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.scheduleBreak.set(null);
    this.scheduleBreaksService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((dto) => {
        this.scheduleBreak.set(dto);
        this.form.reset({
          startsAt: new Date(dto.startsAt),
          durationMinutes: dto.durationMinutes,
          note: dto.note ?? '',
        });
      });
  }
}
