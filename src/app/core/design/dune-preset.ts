import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * PrimeNG preset mapping the Vitalis ink / teal / dusty rose palette (see src/styles.scss) onto
 * PrimeNG's design tokens. Values are intentionally flat hex (no light-dark()) since
 * the design has no separate dark variant - :root { color-scheme: light } in
 * styles.scss further guarantees that regardless of the user's OS setting.
 */
export const DunePreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      xl: '14px',
    },
    green: {
      50: '#EEF9F2',
      100: '#DCF2E5',
      200: '#C8EAD3',
      300: '#A8DCBE',
      400: '#99D3AF',
      500: '#8FCBA8',
      600: '#0D5C63',
      700: '#0A4A50',
      800: '#0A4A50',
      900: '#0A4A50',
      950: '#0A4A50',
    },
    red: {
      50: '#FAF8F9',
      100: '#F4F1F2',
      200: '#EFEBEC',
      300: '#DED5D7',
      400: '#C1A5A9',
      500: '#8E3A4A',
      600: '#8E3A4A',
      700: '#8E3A4A',
      800: '#8E3A4A',
      900: '#8E3A4A',
      950: '#8E3A4A',
    },
  },
  semantic: {
    primary: {
      50: '#EEF9F2',
      100: '#DCF2E5',
      200: '#C8EAD3',
      300: '#A8DCBE',
      400: '#169AA4',
      500: '#0D5C63',
      600: '#0A4A50',
      700: '#0A4A50',
      800: '#0A4A50',
      900: '#0A4A50',
      950: '#0A4A50',
      // Platform accent for buttons, links, and active nav. Hover/active are
      // shades derived from the primary color itself (see
      // branding-colors.util.ts), not the org's secondary color - that stays
      // a free-standing accent instead of doubling as primary's hover state.
      color: 'var(--brand-primary, #0D5C63)',
      contrastColor: 'var(--brand-primary-contrast, #FFFFFF)',
      hoverColor: 'var(--brand-primary-hover, #0A4A50)',
      activeColor: 'var(--brand-primary-active, #0A4A50)',
    },
    surface: {
      0: '#FFFFFF',
      50: '#FDFCFC',
      100: '#F7F4F5',
      200: '#EFEBEC',
      300: '#DED5D7',
      400: '#C1A5A9',
      500: '#7A5D61',
      600: '#545863',
      700: '#3A3E48',
      800: '#2E323C',
      900: '#2E323C',
      950: '#2E323C',
    },
    text: {
      color: '{surface.800}',
      hoverColor: '{surface.900}',
      mutedColor: '{surface.600}',
      hoverMutedColor: '{surface.700}',
    },
    content: {
      background: '{surface.0}',
      hoverBackground: '{surface.200}',
      borderColor: '{surface.300}',
      color: '{text.color}',
      hoverColor: '{text.hoverColor}',
    },
    formField: {
      background: '{surface.0}',
      borderColor: '{surface.300}',
      hoverBorderColor: '{surface.400}',
      color: '{text.color}',
      placeholderColor: '{text.mutedColor}',
    },
  },
});
