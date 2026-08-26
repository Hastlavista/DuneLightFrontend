import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { EmployeeAvailableSlotsDto } from '../../../core/models/appointment.model';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { toDateOnly } from '../../../core/utils/date.util';
import { addDays, startOfDay } from '../schedule-grid/schedule-date.util';

export interface AvailableSlotSelection {
  employeeId: string;
  startsAt: Date;
}

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' });

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, seconds || 0, 0);
  return result;
}

/** Horizontally-scrollable "slobodni termini" picker (frontend #24, last item on
 * the feature list) - once a service+location are chosen on NewAppointmentDialog,
 * fetches GET /api/appointments/available-slots for the displayed day and lets
 * the user jump straight to a free trainer+time instead of guessing manually.
 * Renders nothing until both serviceId/companyId inputs are set. A click emits
 * slotSelected and collapses to a one-line summary ("Promijeni vrijeme" re-opens
 * it) - it never disables the dialog's own manual trainer/time fields, which
 * stay fully usable alongside this either way. */
@Component({
  selector: 'app-available-slots-slider',
  imports: [TranslatePipe, Button],
  templateUrl: './available-slots-slider.component.html',
  styleUrl: './available-slots-slider.component.scss',
})
export class AvailableSlotsSliderComponent {
  private readonly appointmentsService = inject(AppointmentsService);

  readonly serviceId = input<string | null>(null);
  readonly companyId = input<string | null>(null);
  /** The day to show - mirrors the caller's own date field (e.g. the "Datum i
   * vrijeme" field on NewAppointmentDialog, itself seeded from the schedule
   * grid's clicked cell). Only used to seed/re-sync `selectedDate` (see the
   * constructor effect below) - the slider's own prev/next-day nav then
   * browses independently of it without fighting this input. */
  readonly initialDate = input<Date | null>(null);
  /** Set when the picking employee is already fixed - either Member role
   * locked to themselves (see CurrentEmployeeService.employee) or the caller
   * has a Trener already picked in its own form - narrows the query to that
   * employee and skips the redundant per-row name/swatch, since there's only
   * ever one row left to show. */
  readonly lockedEmployeeId = input<string | null>(null);

  readonly slotSelected = output<AvailableSlotSelection>();

  readonly selectedDate = signal(startOfDay(new Date()));
  readonly loading = signal(false);
  readonly expanded = signal(true);

  private readonly rows = signal<EmployeeAvailableSlotsDto[]>([]);
  private readonly selectedSlot = signal<{ employeeId: string; start: string; date: Date } | null>(null);
  private requestToken = 0;

  readonly dateLabel = computed(() => capitalize(DATE_LABEL_FORMATTER.format(this.selectedDate())));

  readonly visibleRows = computed(() => this.rows().filter((row) => row.slots.length > 0));

  readonly summaryLabel = computed(() => {
    const selection = this.selectedSlot();
    if (!selection) {
      return '';
    }
    const employee = this.rows().find((row) => row.employeeId === selection.employeeId);
    const label = `${capitalize(DATE_LABEL_FORMATTER.format(selection.date))} · ${selection.start?.slice(0, 5) ?? ''}`;
    return employee ? `${label} · ${employee.employeeName}` : label;
  });

  constructor() {
    effect(() => {
      const serviceId = this.serviceId();
      const companyId = this.companyId();
      const employeeId = this.lockedEmployeeId();
      const date = this.selectedDate();
      if (!serviceId || !companyId) {
        this.rows.set([]);
        return;
      }
      this.fetchSlots(serviceId, companyId, employeeId, date);
    });

    // Re-sync the displayed day whenever the caller's own date changes (dialog
    // open with a pre-filled date, or the user editing the "Datum i vrijeme"
    // field). `selectedDate` is read untracked so this doesn't fire back on
    // the slider's own prev/next-day nav, which only touches `selectedDate`.
    effect(() => {
      const initial = this.initialDate();
      if (!initial) {
        return;
      }
      const day = startOfDay(initial);
      if (!isSameDay(day, untracked(this.selectedDate))) {
        this.selectedDate.set(day);
      }
    });

    // If the caller's locked/picked trainer changes to someone other than the
    // one behind an already-made selection, that selection no longer applies
    // - drop it and re-expand so the slider re-offers slots for the new
    // trainer instead of showing a stale "Promijeni vrijeme" summary.
    effect(() => {
      const employeeId = this.lockedEmployeeId();
      const selection = this.selectedSlot();
      if (employeeId && selection && selection.employeeId !== employeeId) {
        this.selectedSlot.set(null);
        this.expanded.set(true);
      }
    });
  }

  goPrevDay(): void {
    this.selectedDate.update((date) => addDays(date, -1));
  }

  goNextDay(): void {
    this.selectedDate.update((date) => addDays(date, 1));
  }

  expand(): void {
    this.expanded.set(true);
  }

  isSelected(employeeId: string, start: string): boolean {
    const selection = this.selectedSlot();
    return !!selection && selection.employeeId === employeeId && selection.start === start && isSameDay(selection.date, this.selectedDate());
  }

  onSlotClick(employeeId: string, start: string): void {
    const date = this.selectedDate();
    this.selectedSlot.set({ employeeId, start, date });
    this.expanded.set(false);
    this.slotSelected.emit({ employeeId, startsAt: combineDateAndTime(date, start) });
  }

  private fetchSlots(serviceId: string, companyId: string, employeeId: string | null, date: Date): void {
    const token = ++this.requestToken;
    this.loading.set(true);
    this.appointmentsService.getAvailableSlots({ serviceId, companyId, date: toDateOnly(date), employeeId }).subscribe({
      next: (result) => {
        if (token !== this.requestToken) {
          return;
        }
        this.rows.set(result);
        this.loading.set(false);
      },
      error: () => {
        if (token !== this.requestToken) {
          return;
        }
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }
}
