import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { GrantGroupsService } from '../../../../../core/services/grant-groups.service';
import { OnboardingStatusDto } from '../../../../../core/models/onboarding-status.model';
import { OnboardingStatusService } from '../../../../../core/services/onboarding-status.service';
import { CompleteEmployeeProfileDialogComponent } from '../../../../../shared/components/complete-employee-profile/complete-employee-profile-dialog.component';

interface LinkStep {
  kind: 'link';
  /** Most steps mirror an OnboardingStatusDto flag 1:1, but 'hasGrantGroup'
   * has no backend flag of its own (see hasGrantGroup's own doc) - widened
   * from keyof OnboardingStatusDto to plain string for that one. */
  id: keyof OnboardingStatusDto | 'hasGrantGroup';
  titleKey: string;
  descriptionKey: string;
  routerLink: string[];
  queryParams?: Record<string, string | undefined>;
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
 * dashboard that guides a freshly-registered organization (no companies,
 * engagement types, services, ...) through setup in the right order. Fetches
 * GET /api/onboarding-status once and hides itself entirely once every flag
 * is true - unlike CompleteEmployeeProfileCtaComponent, this is not
 * isOwner-gated by itself (any admin-area visitor benefits from the guide),
 * but the "Vaš profil" step's action is, since only the Owner can complete
 * their own profile via this flow (see CompleteEmployeeProfileCtaComponent's
 * own doc for why). The "Ovlasti" (hasGrantGroup) step is entirely omitted
 * for non-Owners the same way, since /app/permissions is ownerGuard-only -
 * see hasGrantGroup's own doc.
 */
@Component({
  selector: 'app-onboarding-checklist',
  imports: [RouterLink, TranslatePipe, CompleteEmployeeProfileDialogComponent],
  templateUrl: './onboarding-checklist.component.html',
  styleUrl: './onboarding-checklist.component.scss',
})
export class OnboardingChecklistComponent {
  private readonly onboardingStatusService = inject(OnboardingStatusService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly grantGroupsService = inject(GrantGroupsService);
  private readonly authService = inject(AuthService);

  private readonly status = signal<OnboardingStatusDto | null>(null);

  readonly isOwner = this.currentEmployeeService.isOwner;

  /** No backend onboarding-status flag exists for this (unlike every other
   * step) - GrantGroups are an Owner-only resource fetched straight from
   * GrantGroupsService instead. Since employee creation no longer hands out
   * any default grants (a brand-new org starts with zero GrantGroups), the
   * "Zaposlenici" step below is a dead end until at least one exists to pick
   * from - this step exists to surface that before the Owner gets there.
   * Starts true so the step doesn't flash as "not done" before the Owner-only
   * fetch below resolves (or never resolves, for a non-Owner). */
  readonly hasGrantGroup = signal(true);
  private grantGroupsChecked = false;

  /** Shown in a callout above the checklist - this is the only place a
   * freshly-registered Owner can see the slug they'll need on every future
   * login (register() goes straight into the app, no confirmation screen).
   * Will eventually also be emailed to them; for now this is the only copy. */
  readonly organizationSlug = this.authService.organizationSlug;

  readonly steps = computed<ChecklistStep[]>(() => {
    const status = this.status();
    if (!status) {
      return [];
    }
    return [
      {
        kind: 'link',
        id: 'hasCompany',
        titleKey: 'DASHBOARD.ONBOARDING.COMPANY_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.COMPANY_DESC',
        routerLink: ['/app/companies'],
        queryParams: { create: 'company' },
        actionKey: 'DASHBOARD.ONBOARDING.COMPANY_ACTION',
        done: status.hasCompany,
      },
      {
        kind: 'link',
        id: 'hasEngagementType',
        titleKey: 'DASHBOARD.ONBOARDING.ENGAGEMENT_TYPE_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.ENGAGEMENT_TYPE_DESC',
        routerLink: ['/app/employees'],
        queryParams: { tab: 'engagement-types', create: 'engagement-type' },
        actionKey: 'DASHBOARD.ONBOARDING.ENGAGEMENT_TYPE_ACTION',
        done: status.hasEngagementType,
      },
      {
        kind: 'link',
        id: 'hasService',
        titleKey: 'DASHBOARD.ONBOARDING.SERVICE_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.SERVICE_DESC',
        routerLink: ['/app/services'],
        queryParams: { tab: 'services', create: 'service' },
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
      // Owner-only, and no OnboardingStatusDto flag backs it - see
      // hasGrantGroup's own doc. Placed right before "Zaposlenici" since
      // that's the step it unblocks.
      ...(this.isOwner()
        ? [
            {
              kind: 'link' as const,
              id: 'hasGrantGroup' as const,
              titleKey: 'DASHBOARD.ONBOARDING.GRANT_GROUP_TITLE',
              descriptionKey: 'DASHBOARD.ONBOARDING.GRANT_GROUP_DESC',
              routerLink: ['/app/permissions/grant-groups/new'],
              actionKey: 'DASHBOARD.ONBOARDING.GRANT_GROUP_ACTION',
              done: this.hasGrantGroup(),
            },
          ]
        : []),
      {
        kind: 'link',
        id: 'hasOtherEmployee',
        titleKey: 'DASHBOARD.ONBOARDING.OTHER_EMPLOYEE_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.OTHER_EMPLOYEE_DESC',
        routerLink: ['/app/employees/new'],
        actionKey: 'DASHBOARD.ONBOARDING.OTHER_EMPLOYEE_ACTION',
        done: status.hasOtherEmployee,
      },
      {
        kind: 'link',
        id: 'hasClient',
        titleKey: 'DASHBOARD.ONBOARDING.CLIENT_TITLE',
        descriptionKey: 'DASHBOARD.ONBOARDING.CLIENT_DESC',
        routerLink: ['/app/clients/new'],
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
   * "Dovrši profil" form's dropdowns are useless until a company and
   * engagement type exist, so don't open it onto an empty, unexplained state. */
  readonly profilePrerequisitesMissing = signal(false);

  constructor() {
    this.refreshStatus();

    // isOwner() only resolves once CurrentEmployeeService's async /me load
    // finishes, so this can't just run once at construction - wait for it,
    // and skip entirely for a non-Owner (GET .../grant-groups is Owner-only,
    // see GrantGroupsService's own doc).
    effect(() => {
      if (this.isOwner() && !this.grantGroupsChecked) {
        this.grantGroupsChecked = true;
        this.grantGroupsService.getAll().subscribe((groups) => this.hasGrantGroup.set(groups.length > 0));
      }
    });
  }

  onOwnerProfileClick(): void {
    const status = this.status();
    if (!status) {
      return;
    }
    if (status.hasCompany && status.hasEngagementType) {
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
