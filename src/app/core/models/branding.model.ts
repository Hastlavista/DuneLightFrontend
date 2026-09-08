/** Organization branding - powers the login screen and the whole app's look.
 * Every field is nullable: `null` means "not set, use the platform default". */
export interface OrganizationBranding {
  /** Relative URL, e.g. "/uploads/branding/slug/logo-a1b2c3d4e5f6.png". */
  logo: string | null;
  /** Relative URL, e.g. "/uploads/branding/slug/favicon-b2c3d4e5f6a7.png". */
  favicon: string | null;
  /** HEX color, e.g. "#1A73E8". */
  primaryColor: string | null;
  /** HEX color, e.g. "#185ABC". */
  secondaryColor: string | null;
}

/** GET /api/organization/branding (owner-only) - public get shape plus the
 * organization's own identity, used by the branding settings page. */
export interface OrganizationBrandingResponse extends OrganizationBranding {
  organizationName: string;
  organizationSlug: string;
}

/** PUT /api/organization/branding/colors (owner-only) request body. */
export interface BrandingColorsUpdateRequest {
  primaryColor: string | null;
  secondaryColor: string | null;
}

/** POST /api/organization/branding/upload/{logo|favicon} response. */
export interface BrandingUploadResponse {
  url: string;
}
