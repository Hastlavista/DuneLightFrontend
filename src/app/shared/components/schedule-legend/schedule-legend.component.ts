import { Component, input } from '@angular/core';
import { ServiceCategoryDto } from '../../../core/models/service-category.model';

/** Color legend for the schedule grids - appointment blocks are colored by
 * their service category (serviceCategoryColorHex), this just spells out what
 * each color means. Reused by grid A and grid B. */
@Component({
  selector: 'app-schedule-legend',
  template: `
    <div class="schedule-legend">
      @for (category of categories(); track category.id) {
        <span class="schedule-legend__item">
          <span class="schedule-legend__swatch" [style.background]="category.colorHex ?? '#c9b487'"></span>
          {{ category.name }}
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
  readonly categories = input<ServiceCategoryDto[]>([]);
}
