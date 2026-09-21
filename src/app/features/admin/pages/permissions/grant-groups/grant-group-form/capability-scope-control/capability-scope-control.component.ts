import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { SelectButton } from 'primeng/selectbutton';
import { CapabilityScopeModel, CapabilitySelectedScope } from '../../../../../../../core/models/capability.model';
import { legalScopesFor } from '../../../../../../../core/permissions/capability-materialization';
import { scopeOptionLabelKey } from '../../../../../../../core/permissions/capability-presentation';

interface ScopeOption {
  value: CapabilitySelectedScope;
  label: string;
}

/**
 * FAZA 1 Part F - ONE control per capability, its option set entirely
 * determined by the capability's ScopeModel:
 * - None: [ Isključeno | Uključeno ]
 * - ViewManage: [ Nema pristupa | Pregled | Uređivanje ]
 * - OwnAll: [ Nema pristupa | Samo vlastito | Sve ]
 * - ViewOwnAll: [ Nema pristupa | Pregled | Samo vlastito | Sve ]
 *
 * Never renders the underlying .view/.manage/.own/.all raw grants - the
 * CapabilitySelectedScope IS the UX abstraction (see capability-
 * materialization.ts for how a scope resolves to raw grants, used only for
 * display/reconstruction elsewhere, never wired to this control's output).
 *
 * Labels are resolved eagerly (translate.instant) rather than through a
 * custom p-selectbutton item template - optionLabel only ever reads a plain
 * field off each option object, so the translated string itself is the
 * simplest, most robust "field" to hand it.
 */
@Component({
  selector: 'app-capability-scope-control',
  imports: [FormsModule, SelectButton],
  templateUrl: './capability-scope-control.component.html',
})
export class CapabilityScopeControlComponent {
  private readonly translate = inject(TranslateService);

  @Input({ required: true }) scopeModel!: CapabilityScopeModel;
  @Input({ required: true }) selectedScope!: CapabilitySelectedScope;
  @Input() disabled = false;
  @Output() readonly selectedScopeChange = new EventEmitter<CapabilitySelectedScope>();

  /** Plain getter (not a cached signal) - `scopeModel` is a regular @Input,
   * not a signal source, so this must re-derive on every template read
   * rather than caching a value from the first access. */
  get options(): ScopeOption[] {
    return legalScopesFor(this.scopeModel).map((value) => ({
      value,
      label: this.translate.instant(scopeOptionLabelKey(this.scopeModel, value)),
    }));
  }

  onChange(value: CapabilitySelectedScope): void {
    if (value !== this.selectedScope) {
      this.selectedScopeChange.emit(value);
    }
  }
}
