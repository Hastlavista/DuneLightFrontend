import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../../shared/components/page-placeholder/page-placeholder.component';
import { OnboardingChecklistComponent } from './onboarding-checklist/onboarding-checklist.component';

/**
 * The standalone "Dovrši profil" CTA banner (CompleteEmployeeProfileCtaComponent)
 * is deliberately NOT shown here - OnboardingChecklistComponent's own step 4
 * ("Vaš profil") covers the exact same ground on this screen, so both at once
 * would just repeat the same message twice in a row (frontend #25 follow-up).
 * The banner still lives on my-week/my-shifts/shifts, which have no checklist
 * of their own.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [PagePlaceholderComponent, OnboardingChecklistComponent],
  template: `
    <app-onboarding-checklist />
    <app-page-placeholder titleKey="NAV.ADMIN.DASHBOARD" icon="pi-home" />
  `,
})
export class DashboardComponent {}
