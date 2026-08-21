import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { OnboardingStatusDto } from '../../../../../core/models/onboarding-status.model';
import { OnboardingStatusService } from '../../../../../core/services/onboarding-status.service';
import { CompleteEmployeeProfileDialogComponent } from '../../../../../shared/components/complete-employee-profile/complete-employee-profile-dialog.component';

interface LinkStep {
  kind: 'link';
  id: keyof OnboardingStatusDto;
  titleKey: string;
  descriptionKey: string;
  routerLink: string[];
  queryParams?: Record<string, string>;
  actionKey: string;
  done: boolean;
}

interface ProfileStep {
  kind: 'profile';
  id: keyof OnboardingStatusDto;
  titleKey: string;
  descriptionKey: string;
  actionKey: string;
  done: boolean;
}

type ChecklistStep = LinkStep | ProfileStep;

/**
 * "Checklist za početak" (frontend #25) - a self-contained widget on the admin
 * dashboard that guides a freshly-registered organization (no locations,
 * engagement types, services, ...) through setup in the right order. Fetches
 * GET /api/onboarding-status once and hides itself entirely once every flag
 * is true - unlike CompleteEmployeeProfileCtaComponent, this is not
 * isOwner-gated by itself (any admin-area visitor benefits from the guide),
 * but the "Vaš profil" step's action is, since only the Owner can complete
 * their own profile via this flow (see CompleteEmployeeProfileCtaComponent's
 * own doc for why).
 */
@Component({
  selector: 'app-onboarding-checklist',
  imports: [RouterLink, TranslatePipe, Button, CompleteEmployeeProfileDialogComponent],
  templateUrl: './onboarding-checklist.component.html',
  styleUrl: './onboarding-checklist.component.scss',
})
export class OnboardingChecklistComponent {
  private readonly onboardingStatusService = inject(OnboardingStatusService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  private readonly status = signal<OnboardingStatusDto | null>(null);

  readonly isOwner = this.currentEmployeeService.isOwner;

  readonly steps = computed<ChecklistStep[]>(() => {
    const status = this.status();
    if (!status) {
      return [];
    }
    return [
      {
        kind: 'link',
        id: 'hasLocation',
        titleKey: 'DASHBOARD.ONBOARDING.LOCATION_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.LOCATION_DESC',
        routerLink: ['/admin/locations'],
        actionKey: 'DASHBOARD.ONBOARDING.LOCATION_ACTION',
        done: status.hasLocation,
      },
      {
        kind: 'link',
        id: 'hasEngagementType',
        titleKey: 'DASHBOARD.ONBOARDING.ENGAGEMENT_TYPE_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.ENGAGEMENT_TYPE_DESC',
        routerLink: ['/admin/employees'],
        queryParams: { tab: 'engagement-types' },
        actionKey: 'DASHBOARD.ONBOARDING.ENGAGEMENT_TYPE_ACTION',
        done: status.hasEngagementType,
      },
      {
        kind: 'link',
        id: 'hasService',
        titleKey: 'DASHBOARD.ONBOARDING.SERVICE_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.SERVICE_DESC',
        routerLink: ['/admin/services'],
        queryParams: { tab: 'services' },
        actionKey: 'DASHBOARD.ONBOARDING.SERVICE_ACTION',
        done: status.hasService,
      },
      {
        kind: 'profile',
        id: 'hasOwnerProfile',
        titleKey: 'DASHBOARD.ONBOARDING.OWNER_PROFILE_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.OWNER_PROFILE_DESC',
        actionKey: 'DASHBOARD.ONBOARDING.OWNER_PROFILE_ACTION',
        done: status.hasOwnerProfile,
      },
      {
        kind: 'link',
        id: 'hasOtherEmployee',
        titleKey: 'DASHBOARD.ONBOARDING.OTHER_EMPLOYEE_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.OTHER_EMPLOYEE_DESC',
        routerLink: ['/admin/employees/new'],
        actionKey: 'DASHBOARD.ONBOARDING.OTHER_EMPLOYEE_ACTION',
        done: status.hasOtherEmployee,
      },
      {
        kind: 'link',
        id: 'hasClient',
        titleKey: 'DASHBOARD.ONBOARDING.CLIENT_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.CLIENT_DESC',
        routerLink: ['/admin/clients/new'],
        actionKey: 'DASHBOARD.ONBOARDING.CLIENT_ACTION',
        done: status.hasClient,
      },
    ];
  });

  readonly shouldShow = computed(() => this.steps().length > 0 && this.steps().some((step) => !step.done));

  /** The first not-yet-done step, by the fixed order above - visually
   * highlighted as "what to do next", though every step stays clickable
   * (this is a guide, not a hard gate - frontend #25). */
  readonly nextStepId = computed(() => this.steps().find((step) => !step.done)?.id ?? null);

  readonly profileDialogVisible = signal(false);
  /** Same rule as CompleteEmployeeProfileCtaComponent.openDialog(): the
   * "Dovrši profil" form's dropdowns are useless until a location and
   * engagement type exist, so don't open it onto an empty, unexplained state. */
  readonly profilePrerequisitesMissing = signal(false);

  constructor() {
    this.refreshStatus();
  }

  onOwnerProfileClick(): void {
    const status = this.status();
    if (!status) {
      return;
    }
    if (status.hasLocation && status.hasEngagementType) {
      this.profilePrerequisitesMissing.set(false);
      this.profileDialogVisible.set(true);
    } else {
      this.profilePrerequisitesMissing.set(true);
    }
  }

  onProfileCompleted(): void {
    this.refreshStatus();
  }

  private refreshStatus(): void {
    this.onboardingStatusService.getStatus().subscribe((status) => this.status.set(status));
  }
}
