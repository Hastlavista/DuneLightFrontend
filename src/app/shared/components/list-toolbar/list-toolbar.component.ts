import { Component, DestroyRef, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { ToggleSwitch } from 'primeng/toggleswitch';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Toolbar shared by every admin šifrarnik list screen: search box (debounced),
 * "show inactive" switch and a "new" button. Dumb component - the parent owns
 * the actual page/query state and reacts to (searchChange)/(showInactiveChange).
 */
@Component({
  selector: 'app-list-toolbar',
  imports: [FormsModule, TranslatePipe, IconField, InputIcon, InputText, ToggleSwitch, Button],
  templateUrl: './list-toolbar.component.html',
  styleUrl: './list-toolbar.component.scss',
})
export class ListToolbarComponent {
  private readonly destroyRef = inject(DestroyRef);
  private debounceHandle: ReturnType<typeof setTimeout> | undefined;

  readonly newLabelKey = input('COMMON.NEW');
  readonly search = input('');
  readonly showInactive = input(false);

  readonly searchChange = output<string>();
  readonly showInactiveChange = output<boolean>();
  readonly create = output<void>();

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.debounceHandle));
  }

  onSearchInput(value: string): void {
    clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => this.searchChange.emit(value), SEARCH_DEBOUNCE_MS);
  }
}
