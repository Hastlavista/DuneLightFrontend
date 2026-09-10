import { applyBrandCssVariables, deriveBrandCssVariables } from './branding-colors.util';
import { readCachedBrandColors, resolveBootOrganizationSlug } from './branding-cache.util';

/** Applies the org's last-known colors synchronously, before Angular boots -
 * called from main.ts. Without this, every hard reload of an authenticated
 * route paints the default palette first and only jumps to the org's colors
 * once ShellComponent's/LoginComponent's HTTP fetch resolves, a visible
 * flash now that most of the app reads --brand-primary. The real fetch still
 * runs right after and silently overwrites these with fresh values. */
export function applyCachedBrandingOnBoot(): void {
  const slug = resolveBootOrganizationSlug();
  if (!slug) {
    return;
  }
  const cached = readCachedBrandColors(slug);
  if (!cached) {
    return;
  }
  applyBrandCssVariables(document.documentElement, deriveBrandCssVariables(cached.primaryColor, cached.secondaryColor));
}
