import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CapabilitySensitivity } from '../../../../../../../core/models/capability.model';
import { sensitivityLabelKey } from '../../../../../../../core/permissions/capability-presentation';

/**
 * FAZA 1 Part G - awareness UX only, driven entirely by
 * CapabilityDefinition.Sensitivity (never a hard-coded key list - see
 * grant-group-form.component's own doc). Normal renders nothing; Sensitive
 * shows a subtle marker; HighRisk shows a stronger one. Never disables or
 * blocks selection - the Owner may still select a HighRisk capability
 * freely, this is purely informational (Part G explicitly forbids adding a
 * new authorization restriction here).
 */
@Component({
  selector: 'app-capability-sensitivity-badge',
  imports: [TranslatePipe],
  templateUrl: './capability-sensitivity-badge.component.html',
  styleUrl: './capability-sensitivity-badge.component.scss',
})
export class CapabilitySensitivityBadgeComponent {
  @Input({ required: true }) sensitivity!: CapabilitySensitivity;

  readonly labelKeyFor = sensitivityLabelKey;
}
