import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RadioButton } from 'primeng/radiobutton';
import { ConflictDto, ConflictResolution } from '../../../../../../../../core/models/capability.model';
import { capabilityLabelKey, resolveOrFallback, scopeOptionLabelKey } from '../../../../../../../../core/permissions/capability-presentation';

/**
 * One row per GrantGroupTemplateDiffDto.conflicts entry (plan section 5,
 * "Conflict rows"). Purely presentational - the parent dialog owns the
 * `resolutions` map and only inserts an entry into it once the viewer
 * explicitly picks a radio (or the bulk "Zadrži sve moje postavke" action
 * runs), never pre-filled with the backend's `defaultResolution` (strict
 * conflict-gating decision).
 */
@Component({
  selector: 'app-conflict-resolution-row',
  imports: [FormsModule, RadioButton, TranslatePipe],
  templateUrl: './conflict-resolution-row.component.html',
  styleUrl: './conflict-resolution-row.component.scss',
})
export class ConflictResolutionRowComponent {
  private readonly translate = inject(TranslateService);

  readonly conflict = input.required<ConflictDto>();
  readonly selectedResolution = input<ConflictResolution | null>(null);
  /** currentTemplate.version / targetTemplate.version off the parent diff -
   * only used for the "Predložak v{old}"/"Predložak v{new}" row labels. */
  readonly oldTemplateVersion = input.required<number>();
  readonly newTemplateVersion = input.required<number>();
  readonly resolutionChange = output<ConflictResolution>();

  capabilityLabel(): string {
    return resolveOrFallback(this.translate, capabilityLabelKey(this.conflict().capabilityKey), this.conflict().capabilityKey);
  }

  /** All three scopes shown on a conflict row (BASE/CURRENT/TARGET) belong to
   * the same capability, so any ScopeModel-aware label lookup would need the
   * capability's ScopeModel - not carried on ConflictDto. 'On'/'None' only
   * ever appear together on a ScopeModel.None capability, so that pair is
   * special-cased directly; every other value is a ViewOwnAll-style option
   * key covering the rest of CapabilitySelectedScope, degrading gracefully
   * via resolveOrFallback for anything unexpected. */
  scopeLabel(scope: ConflictDto['baseScope']): string {
    if (scope === 'On') {
      return resolveOrFallback(this.translate, scopeOptionLabelKey('None', 'On'), scope);
    }
    return resolveOrFallback(this.translate, scopeOptionLabelKey('ViewOwnAll', scope), scope);
  }

  onChoose(resolution: ConflictResolution): void {
    this.resolutionChange.emit(resolution);
  }
}
