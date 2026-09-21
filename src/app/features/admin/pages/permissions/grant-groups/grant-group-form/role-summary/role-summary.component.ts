import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CapabilitySelectionResult } from '../../../../../../../core/permissions/capability-materialization';
import {
  capabilityLabelKey,
  categoryLabelKey,
  CapabilityCategoryGroup,
  groupByCategory,
  scopeOptionLabelKey,
} from '../../../../../../../core/permissions/capability-presentation';

interface SummaryRow {
  capabilityKey: string;
  labelKey: string;
  scopeLabelKey: string;
}

interface SummaryCategory {
  categoryKey: string;
  categoryLabelKey: string;
  rows: SummaryRow[];
}

/**
 * FAZA 1 Part I - plain-language "what can this role actually do" summary,
 * generated ENTIRELY from CapabilityDefinition metadata + selected scope +
 * frontend translations (never from raw GrantGroupGrant rows - see
 * grant-group-form.component's reconstruction, which is the only place raw
 * grants get interpreted at all). A capability with selectedScope null
 * (unmatched/ambiguous, see capability-materialization.ts) or 'None' is
 * simply omitted - it contributes nothing to what this role can do.
 */
@Component({
  selector: 'app-role-summary',
  imports: [TranslatePipe],
  templateUrl: './role-summary.component.html',
  styleUrl: './role-summary.component.scss',
})
export class RoleSummaryComponent {
  @Input({ required: true }) selections: CapabilitySelectionResult[] = [];

  get categories(): SummaryCategory[] {
    const active = this.selections.filter((s) => s.selectedScope && s.selectedScope !== 'None');
    const groups: CapabilityCategoryGroup[] = groupByCategory(active.map((s) => s.capability));
    return groups.map((group) => ({
      categoryKey: group.categoryKey,
      categoryLabelKey: categoryLabelKey(group.categoryKey),
      rows: group.capabilities.map((capability) => {
        const selection = active.find((s) => s.capability.key === capability.key)!;
        return {
          capabilityKey: capability.key,
          labelKey: capabilityLabelKey(capability.key),
          scopeLabelKey: scopeOptionLabelKey(capability.scopeModel, selection.selectedScope!),
        };
      }),
    }));
  }
}
