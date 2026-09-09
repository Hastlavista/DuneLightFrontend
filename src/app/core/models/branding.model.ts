/** Organization identity displayed on login and in the application shell. */
export interface OrganizationBranding {
  /** Relative URL, e.g. "/uploads/branding/slug/logo-a1b2c3d4e5f6.png". */
  logo: string | null;
  /** Relative URL, e.g. "/uploads/branding/slug/favicon-b2c3d4e5f6a7.png". */
  favicon: string | null;
}
