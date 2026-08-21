import { Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { OnboardingStatusService } from '../../../core/services/onboarding-status.service';
import { CompleteEmployeeProfileDialogComponent } from './complete-employee-profile-dialog.component';

/**
 * Self-contained "dovrši svoj profil" call-to-action (frontend #15) - renders
 * nothing unless the logged-in user is the Owner AND has no Employee profile
 * yet (isOwner() is only reliable once CurrentEmployeeService has loaded, see
 * its own doc, so this naturally stays hidden during that initial load too).
 * Deliberately gated on isOwner(), not just hasProfile(): a non-Owner somehow
 * missing a profile is a different, unexpected situation (see
 * CurrentEmployeeService.load()'s 404 handling, which logs anyone else out
 * instead) that this banner must not offer to "fix" by creating a second
 * Employee record.
 *
 * Owns its own CompleteEmployeeProfileDialogComponent instance so any host
 * page can just drop in `<app-complete-employee-profile-cta>` - on success the
 * dialog already refreshes CurrentEmployeeService itself, which is what makes
 * this banner disappear again without the host needing to do anything.
 */
@Component({
  selector: 'app-complete-employee-profile-cta',
  imports: [Button, TranslatePipe, RouterLink, CompleteEmployeeProfileDialogComponent],
  templateUrl: './complete-employee-profile-cta.component.html',
  styleUrl: './complete-employee-profile-cta.component.scss',
})
export class CompleteEmployeeProfileCtaComponent {
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly onboardingStatusService = inject(OnboardingStatusService);

  readonly completed = output<void>();

  readonly shouldShow = computed(
    () => this.currentEmployeeService.isOwner() && !this.currentEmployeeService.hasProfile(),
  );

  readonly dialogVisible = signal(false);
  /** Set once openDialog() finds hasLocation/hasEngagementType unmet - the form
   * has no explanation for its own three dropdowns, so it must not open onto
   * an empty, unusable state (frontend #25). */
  readonly prerequisitesMissing = signal(false);

  openDialog(): void {
    this.onboardingStatusService.getStatus().subscribe((status) => {
      if (status.hasLocation && status.hasEngagementType) {
        this.prerequisitesMissing.set(false);
        this.dialogVisible.set(true);
      } else {
        this.prerequisitesMissing.set(true);
      }
    });
  }

  onCompleted(): void {
    this.completed.emit();
  }
}
