import { colord } from 'colord';

/** All CSS custom properties derived from an org's primary/secondary brand
 * colors. Listed explicitly (not just "whatever's in the partial object") so
 * applyBrandCssVariables can always remove a stale property that a new call
 * no longer supplies - see its doc comment. */
const BRAND_CSS_PROPERTIES = [
  '--brand-primary',
  '--brand-primary-hover',
  '--brand-primary-active',
  '--brand-primary-light',
  '--brand-primary-contrast',
  '--brand-secondary',
  '--brand-secondary-contrast',
] as const;

export type BrandCssProperty = (typeof BRAND_CSS_PROPERTIES)[number];
export type BrandCssVariables = Partial<Record<BrandCssProperty, string>>;

/** Derives the full set of brand CSS variables from the two colors the org
 * actually picks. Hover/active are darkened shades of the primary color
 * (not the secondary color - see dune-preset.ts) so they stay visually
 * related to the button/element they belong to regardless of what the org
 * picked as their secondary accent. */
export function deriveBrandCssVariables(primaryColor: string | null, secondaryColor: string | null): BrandCssVariables {
  const vars: BrandCssVariables = {};
  if (primaryColor) {
    const primary = colord(primaryColor);
    vars['--brand-primary'] = primaryColor;
    vars['--brand-primary-hover'] = primary.darken(0.08).toHex();
    vars['--brand-primary-active'] = primary.darken(0.14).toHex();
    vars['--brand-primary-light'] = primary.lighten(0.38).toHex();
    vars['--brand-primary-contrast'] = contrastColor(primaryColor);
  }
  if (secondaryColor) {
    vars['--brand-secondary'] = secondaryColor;
    vars['--brand-secondary-contrast'] = contrastColor(secondaryColor);
  }
  return vars;
}

/** Sets every brand CSS property present in `vars` and removes every one
 * that isn't (falling back to the static defaults in styles.scss) - so a
 * caller only has to pass what it knows, not diff against what's already on
 * the root. */
export function applyBrandCssVariables(root: HTMLElement, vars: BrandCssVariables): void {
  for (const property of BRAND_CSS_PROPERTIES) {
    const value = vars[property];
    if (value) {
      root.style.setProperty(property, value);
    } else {
      root.style.removeProperty(property);
    }
  }
}

/** WCAG relative-luminance contrast: picks readable ink/white text for an
 * arbitrary background color the org chose. */
export function contrastColor(hex: string): '#FFFFFF' | '#2E323C' {
  const value = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const luminance = [red, green, blue]
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.38 ? '#2E323C' : '#FFFFFF';
}
