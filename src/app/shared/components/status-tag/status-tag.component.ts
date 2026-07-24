import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';

/** Aktivno/Neaktivno badge, reused by every admin šifrarnik table. */
@Component({
  selector: 'app-status-tag',
  imports: [Tag, TranslatePipe],
  template: `
    <p-tag
      [severity]="active() ? 'success' : 'secondary'"
      [value]="(active() ? 'COMMON.STATUS_ACTIVE' : 'COMMON.STATUS_INACTIVE') | translate"
    />
  `,
})
export class StatusTagComponent {
  readonly active = input.required<boolean>();
}
