/** GET /api/onboarding-status - drives the "Checklist za početak" dashboard
 * widget (frontend #25) and the "Dovrši profil" CTA's prerequisite check.
 * Every flag is a simple existence check within the caller's organization -
 * none of them consider whether the underlying record is active or inactive. */
export interface OnboardingStatusDto {
  hasCompany: boolean;
  hasEngagementType: boolean;
  hasService: boolean;
  /** Whether the organization has an Employee record belonging to someone
   * other than the current caller (Residual IsOwner Removal - the caller's
   * own profile is known locally via CurrentEmployeeService.hasProfile(),
   * so it no longer needs a backend flag of its own). */
  hasOtherEmployee: boolean;
  hasClient: boolean;
}
