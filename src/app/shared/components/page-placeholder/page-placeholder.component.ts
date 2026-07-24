import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-page-placeholder',
  imports: [TranslatePipe],
  templateUrl: './page-placeholder.component.html',
  styleUrl: './page-placeholder.component.scss',
})
export class PagePlaceholderComponent {
  readonly titleKey = input.required<string>();
  readonly icon = input('pi-hourglass');
}
