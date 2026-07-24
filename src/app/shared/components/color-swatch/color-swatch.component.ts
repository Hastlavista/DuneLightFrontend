import { Component, input } from '@angular/core';

/** Small color square used in šifrarnik tables (location/category color column)
 * and next to the color picker in their forms. */
@Component({
  selector: 'app-color-swatch',
  template: `<span class="color-swatch" [style.background]="colorHex() ?? 'transparent'"></span>`,
  styles: `
    .color-swatch {
      display: inline-block;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 4px;
      border: 1px solid var(--sand-deep);
      vertical-align: middle;
    }
  `,
})
export class ColorSwatchComponent {
  readonly colorHex = input<string | null>(null);
}
