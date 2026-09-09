import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../http/http-context.tokens';
import {
  BrandingColorsUpdateRequest,
  BrandingUploadResponse,
  OrganizationBranding,
  OrganizationBrandingResponse,
} from '../models/branding.model';

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
    const root = document.documentElement;
    root.style.removeProperty('--brand-primary');
    root.style.removeProperty('--brand-secondary');
    root.style.removeProperty('--brand-primary-contrast');
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

  /** GET /api/organization/branding - authenticated settings read. */
  getBranding(): Observable<OrganizationBrandingResponse> {
    return this.http.get<OrganizationBrandingResponse>(`${environment.apiUrl}${PUBLIC_URL_BASE}`);
  }

  updateColors(request: BrandingColorsUpdateRequest): Observable<OrganizationBranding> {
    return this.http.put<OrganizationBranding>(`${environment.apiUrl}${PUBLIC_URL_BASE}/colors`, request);
  }

  resetColors(): Observable<OrganizationBranding> {
    return this.http.delete<OrganizationBranding>(`${environment.apiUrl}${PUBLIC_URL_BASE}/colors`);
  }

  uploadLogo(file: File): Observable<BrandingUploadResponse> {
    return this.upload('logo', file);
  }

  uploadFavicon(file: File): Observable<BrandingUploadResponse> {
    return this.upload('favicon', file);
  }

  deleteLogo(): Observable<OrganizationBranding> {
    return this.http.delete<OrganizationBranding>(`${environment.apiUrl}${PUBLIC_URL_BASE}/logo`);
  }

  deleteFavicon(): Observable<OrganizationBranding> {
    return this.http.delete<OrganizationBranding>(`${environment.apiUrl}${PUBLIC_URL_BASE}/favicon`);
  }

  private upload(kind: 'logo' | 'favicon', file: File): Observable<BrandingUploadResponse> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<BrandingUploadResponse>(`${environment.apiUrl}${PUBLIC_URL_BASE}/upload/${kind}`, body);
  }

}

/** Applies the public organization identity that survives the page cleanup. */
export function applyBranding(branding: OrganizationBranding): void {
  const root = document.documentElement;
  applyColor(root, '--brand-primary', branding.primaryColor);
  applyColor(root, '--brand-secondary', branding.secondaryColor);
  root.style.setProperty('--brand-primary-contrast', contrastColor(branding.primaryColor ?? '#0D5C63'));

  const faviconUrl = resolveBrandingAssetUrl(branding.favicon);
  const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (link) {
    if (faviconUrl) {
      link.href = faviconUrl;
    } else {
      link.href = 'favicon.ico';
    }
  }
}

function applyColor(root: HTMLElement, property: string, color: string | null): void {
  if (color) {
    root.style.setProperty(property, color);
  } else {
    root.style.removeProperty(property);
  }
}

function contrastColor(hex: string): '#FFFFFF' | '#2E323C' {
  const value = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const luminance = [red, green, blue]
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.38 ? '#2E323C' : '#FFFFFF';
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
