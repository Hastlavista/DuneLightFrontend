/** GET /api/onboarding-status - drives the "Checklist za početak" dashboard
 * widget (frontend #25) and the "Dovrši profil" CTA's prerequisite check.
 * Every flag is a simple existence check within the caller's organization -
 * none of them consider whether the underlying record is active or inactive. */
export interface OnboardingStatusDto {
  hasLocation: boolean;
  hasEngagementType: boolean;
  hasService: boolean;
  hasOwnerProfile: boolean;
  hasOtherEmployee: boolean;
  hasClient: boolean;
}
