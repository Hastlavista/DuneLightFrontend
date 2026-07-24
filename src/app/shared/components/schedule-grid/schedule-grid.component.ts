import { Component, computed, input, output } from '@angular/core';
import { computeOverlapLayout } from './schedule-grid-layout.util';
import { ScheduleEmptySlotClickEvent, ScheduleGridCell, ScheduleGridColumn } from './schedule-grid.models';

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const DEFAULT_ROW_HEIGHT_PX = 60;
const DEFAULT_COLUMN_WIDTH_PX = 160;
const MIN_CELL_HEIGHT_PX = 18;
const SNAP_MINUTES = 15;

type PositionedCell = ScheduleGridCell & {
  topPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Low-level, domain-agnostic schedule grid: an hour axis (sticky left column
 * on horizontal scroll) crossed with caller-supplied columns, each appointment
 * absolutely positioned by time-of-day and duration (Google Calendar style,
 * no rounding to full hours). Shared base for grid A (day x trainers) and
 * grid B (week x days) - see ScheduleDayGridComponent/ScheduleWeekGridComponent,
 * which resolve what a "column" means. This component only positions and
 * reports clicks - it holds no appointment/domain knowledge and does not call
 * any service. Moving a termin happens through the edit form in
 * AppointmentDetailDialogComponent (opened via cellClick), not by dragging.
 */
@Component({
  selector: 'app-schedule-grid',
  templateUrl: './schedule-grid.component.html',
  styleUrl: './schedule-grid.component.scss',
})
export class ScheduleGridComponent {
  readonly columns = input.required<ScheduleGridColumn[]>();
  readonly cells = input.required<ScheduleGridCell[]>();
  readonly startHour = input(DEFAULT_START_HOUR);
  readonly endHour = input(DEFAULT_END_HOUR);
  readonly rowHeightPx = input(DEFAULT_ROW_HEIGHT_PX);
  readonly columnWidthPx = input(DEFAULT_COLUMN_WIDTH_PX);

  readonly cellClick = output<ScheduleGridCell>();
  readonly emptySlotClick = output<ScheduleEmptySlotClickEvent>();

  readonly hours = computed<number[]>(() => {
    const result: number[] = [];
    for (let hour = this.startHour(); hour < this.endHour(); hour++) {
      result.push(hour);
    }
    return result;
  });

  readonly totalHeightPx = computed(() => (this.endHour() - this.startHour()) * this.rowHeightPx());

  readonly cellsByColumn = computed<Map<string, PositionedCell[]>>(() => {
    const pxPerMinute = this.rowHeightPx() / 60;
    const startMinutes = this.startHour() * 60;

    const grouped = new Map<string, ScheduleGridCell[]>();
    for (const cell of this.cells()) {
      const list = grouped.get(cell.columnId);
      if (list) {
        list.push(cell);
      } else {
        grouped.set(cell.columnId, [cell]);
      }
    }

    const result = new Map<string, PositionedCell[]>();
    for (const [columnId, columnCells] of grouped) {
      const layout = computeOverlapLayout(
        columnCells.map((cell) => ({ id: cell.id, startMinutes: cell.startMinutes, durationMinutes: cell.durationMinutes })),
      );
      result.set(
        columnId,
        columnCells.map((cell) => {
          const slot = layout.get(cell.id)!;
          const widthPercent = 100 / slot.lanes;
          return {
            ...cell,
            topPx: Math.max(0, (cell.startMinutes - startMinutes) * pxPerMinute),
            heightPx: Math.max(cell.durationMinutes * pxPerMinute, MIN_CELL_HEIGHT_PX),
            leftPercent: slot.lane * widthPercent,
            widthPercent,
          };
        }),
      );
    }
    return result;
  });

  cellsForColumn(columnId: string): PositionedCell[] {
    return this.cellsByColumn().get(columnId) ?? [];
  }

  hourLabel(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  /** Tints the category color into the card background at low opacity, so the
   * whole card reads as "this category" at a glance while staying light enough
   * for the client/service text to stay readable on top. */
  cellBackground(colorHex: string): string {
    return `color-mix(in srgb, ${colorHex} 18%, var(--paper))`;
  }

  onColumnClick(column: ScheduleGridColumn, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.schedule-grid__cell')) {
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const minutesFromStart = offsetY / (this.rowHeightPx() / 60);
    const minutes = clamp(
      snapTo(this.startHour() * 60 + minutesFromStart, SNAP_MINUTES),
      this.startHour() * 60,
      this.endHour() * 60,
    );
    this.emptySlotClick.emit({ columnId: column.id, startMinutes: minutes });
  }

  onCellClick(cell: ScheduleGridCell, event: MouseEvent): void {
    event.stopPropagation();
    this.cellClick.emit(cell);
  }
}
