import { LAST_SLUG_KEY, STORAGE_KEY } from '../auth/auth.service';

const CACHE_KEY_PREFIX = 'dl_branding_colors:';

export interface CachedBrandColors {
  primaryColor: string | null;
  secondaryColor: string | null;
}

/** Persists the org's last-applied colors so the next page load (or hard
 * refresh) can paint them immediately, before the fresh branding fetch
 * resolves - see readCachedBrandColors. Best-effort: a full/disabled
 * localStorage must never break applying branding, only the optimization. */
export function cacheBrandColors(slug: string, colors: CachedBrandColors): void {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + slug, JSON.stringify(colors));
  } catch {
    // localStorage unavailable (private mode, quota, disabled) - skip caching.
  }
}

export function readCachedBrandColors(slug: string): CachedBrandColors | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + slug);
    return raw ? (JSON.parse(raw) as CachedBrandColors) : null;
  } catch {
    return null;
  }
}

/** Best-effort guess, read synchronously before Angular (and its HttpClient)
 * exist, at which org's branding this page load is about to need - mirrors
 * the two places AuthService itself keeps the slug in storage. */
export function resolveBootOrganizationSlug(): string | null {
  try {
    const authRaw = localStorage.getItem(STORAGE_KEY);
    const slug = authRaw ? (JSON.parse(authRaw) as { organizationSlug?: string }).organizationSlug : null;
    if (slug) {
      return slug;
    }
  } catch {
    // malformed/unavailable storage - fall through to the other key.
  }
  try {
    return localStorage.getItem(LAST_SLUG_KEY);
  } catch {
    return null;
  }
}
