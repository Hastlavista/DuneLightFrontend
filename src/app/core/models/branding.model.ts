/** Organization branding returned by the API. Null color values mean the
 * platform palette should be used. */
export interface OrganizationBranding {
  /** Relative URL, e.g. "/uploads/branding/slug/logo-a1b2c3d4e5f6.png". */
  logo: string | null;
  /** Relative URL, e.g. "/uploads/branding/slug/favicon-b2c3d4e5f6a7.png". */
  favicon: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface OrganizationBrandingResponse extends OrganizationBranding {
  organizationName: string;
  organizationSlug: string;
}

export interface BrandingColorsUpdateRequest {
  primaryColor: string;
  secondaryColor: string;
}

export interface BrandingUploadResponse {
  url: string;
}
