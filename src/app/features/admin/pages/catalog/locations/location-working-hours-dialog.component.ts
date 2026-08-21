import { Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Dialog } from 'primeng/dialog';
import { LocationDto } from '../../../../../core/models/location.model';
import {
  WorkingHoursOwner,
  WorkingHoursTemplateEditorComponent,
} from '../../../../../shared/components/working-hours-template-editor/working-hours-template-editor.component';

/**
 * Dedicated wide dialog for a single location's working-hours template
 * (frontend #16). Locations don't have a full-page form the way Employees do
 * (see location-form-dialog.component.ts - deliberately kept small/untouched
 * for its own name/address/phone/color/note fields), so this is a separate
 * entry point opened from its own row action instead of a tab - a temporary
 * arrangement until Lokacije gets a full page of its own, per product
 * decision, not something to fold into the small dialog.
 */
@Component({
  selector: 'app-location-working-hours-dialog',
  imports: [Dialog, TranslatePipe, WorkingHoursTemplateEditorComponent],
  templateUrl: './location-working-hours-dialog.component.html',
})
export class LocationWorkingHoursDialogComponent {
  readonly visible = model(false);
  readonly location = input<LocationDto | null>(null);

  readonly owner = computed<WorkingHoursOwner | null>(() => {
    const location = this.location();
    return location ? { type: 'company', companyId: location.id } : null;
  });

  onClose(): void {
    this.visible.set(false);
  }
}
