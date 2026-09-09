import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import { OrganizationBranding } from '../models/branding.model';

/** API route prefix for the organization branding endpoints. */
const PUBLIC_URL_BASE = '/api/organization/branding';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  /** The org's currently-applied branding - lets presentational components
   * (e.g. the sidebar logo) react to the last value fetched/applied. */
  private readonly brandingState = signal<OrganizationBranding | null>(null);
  readonly branding = this.brandingState.asReadonly();

  constructor(private readonly http: HttpClient) {}

  /** Applies the organization identity and updates the shared state so presentational
   * components (login/sidebar) react to it. */
  apply(branding: OrganizationBranding): void {
    this.brandingState.set(branding);
    applyBranding(branding);
  }

  /** Clears just the shared state signal (no DOM mutation) - used when the
   * login slug field goes empty, so the logo disappears without resetting the
   * favicon while the user is still typing. */
  clear(): void {
    this.brandingState.set(null);
  }

  /** Clears applied branding (e.g. on logout so the next login screen starts
   * clean) and drops the favicon back to the app's. */
  reset(): void {
    this.brandingState.set(null);
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (link) {
      link.removeAttribute('href');
      link.href = 'favicon.ico';
    }
  }

  /** GET /api/organization/branding/public/{slug} - no auth, used by the
   * login screen as soon as the org slug is known. */
  getPublicBranding(slug: string): Observable<OrganizationBranding> {
    return this.http.get<OrganizationBranding>(
      `${environment.apiUrl}${PUBLIC_URL_BASE}/public/${encodeURIComponent(slug)}`,
      { context: new HttpContext().set(SUPPRESS_ERROR_TOAST, true) },
    );
  }

}

/** Applies the public organization identity that survives the page cleanup. */
export function applyBranding(branding: OrganizationBranding): void {
  const faviconUrl = resolveBrandingAssetUrl(branding.favicon);
  if (faviconUrl) {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (link) {
      link.href = faviconUrl;
    }
  }
}

/** Resolves a branding asset's relative URL (as returned by the API) against
 * the API origin - the backend serves uploaded logos/favicons itself, not the
 * Angular app, so a bare relative path resolved by the browser would hit the
 * frontend's own origin instead. */
export function resolveBrandingAssetUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${environment.apiUrl}${path}`;
}
