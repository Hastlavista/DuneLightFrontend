import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * PrimeNG preset mapping the "sunset / dunes" palette (see src/styles.scss) onto
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
      50: '#E5F4F1',
      100: '#C0E6DD',
      200: '#94D5C6',
      300: '#5FC0AC',
      400: '#2E9E86',
      500: '#006E58',
      600: '#00614D',
      700: '#004F3F',
      800: '#003D31',
      900: '#002A22',
      950: '#001813',
    },
    red: {
      50: '#FDECEC',
      100: '#FBD0CF',
      200: '#F6A6A4',
      300: '#EE7B78',
      400: '#DC4A47',
      500: '#C32624',
      600: '#A81F1D',
      700: '#8A1917',
      800: '#6B1312',
      900: '#4D0E0D',
      950: '#300908',
    },
  },
  semantic: {
    primary: {
      50: '#FFF7E0',
      100: '#FFEBB0',
      200: '#FFDD7A',
      300: '#FFCE45',
      400: '#F5BD1C',
      500: '#EEAC00',
      600: '#D69700',
      700: '#AA6900',
      800: '#824F00',
      900: '#5C3800',
      950: '#3A2300',
      color: '{primary.500}',
      contrastColor: '#6C3C37',
      hoverColor: '{primary.700}',
      activeColor: '{primary.800}',
    },
    surface: {
      0: '#FFFFFF',
      50: '#FBF6E7',
      100: '#F3E9CE',
      200: '#E4D3A7',
      300: '#C9B487',
      400: '#B39A6E',
      500: '#8F7A45',
      600: '#7C5647',
      700: '#6C3C37',
      800: '#54302B',
      900: '#3B211D',
      950: '#241211',
    },
    text: {
      color: '{surface.700}',
      hoverColor: '{surface.800}',
      mutedColor: '{surface.500}',
      hoverMutedColor: '{surface.600}',
    },
    content: {
      background: '{surface.100}',
      hoverBackground: '{surface.200}',
      borderColor: '{surface.200}',
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
