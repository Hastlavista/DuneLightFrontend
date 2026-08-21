import { Component, input } from '@angular/core';
import { ServiceDto } from '../../../core/models/service.model';

/** Color legend for the schedule grids - appointment blocks are colored by
 * their service (serviceCategoryColorHex, sourced from the service's own
 * colorHex on the backend), this just spells out what each color means.
 * Reused by grid A and grid B. */
@Component({
  selector: 'app-schedule-legend',
  template: `
    <div class="schedule-legend">
      @for (service of services(); track service.id) {
        <span class="schedule-legend__item">
          <span class="schedule-legend__swatch" [style.background]="service.colorHex ?? '#c9b487'"></span>
          {{ service.name }}
        </span>
      }
    </div>
  `,
  styles: `
    .schedule-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      padding: 0 0.25rem;

      &__item {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.8rem;
        color: var(--clay-2);
      }

      &__swatch {
        display: inline-block;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 3px;
        border: 1px solid var(--sand-deep);
      }
    }
  `,
})
export class ScheduleLegendComponent {
  readonly services = input<ServiceDto[]>([]);
}
