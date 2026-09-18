import { PageKey } from '../core/permissions/page-policies';

export interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
  /** When true, only shown to the organization's Owner (see ownerGuard, which
   * enforces this server-side too - hiding it here is purely a UX nicety). */
  ownerOnly?: boolean;
  /** Resolved through CurrentEmployeeService.canPage() - the same PAGE_POLICIES
   * lookup admin.routes.ts's grantGuard(pageKey) uses, so a page's
   * nav-visibility and its actual navigation gate can never drift apart (see
   * page-policies.ts). Each page's policy includes its `.view` grant too, so
   * a view-only user still sees the item and can look even though that
   * screen's write actions stay hidden/disabled for them (see
   * CurrentEmployeeService.can() / action-policies.ts for that per-action
   * layer). Omit entirely for items every employee should see regardless
   * (Dashboard, personal trainer items, Financije/Izvješća - no grant exists
   * for the latter two yet, so they're open to everyone until one is added).
   */
  pageKey?: PageKey;
}

export interface NavGroup {
  /** Section header translation key. Omit for an ungrouped list (no header rendered). */
  labelKey?: string;
  items: NavItem[];
}

/** One flat sidebar for every employee - each item shows or hides purely on
 * its own pageKey/ownerOnly (see SidebarComponent), not on any admin/trainer
 * section anymore. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { labelKey: 'NAV.TRAINER.MY_WEEK', path: 'my-week', icon: 'pi-calendar' },
      { labelKey: 'NAV.TRAINER.TODAY_ALL', path: 'today', icon: 'pi-calendar-clock' },
      { labelKey: 'NAV.TRAINER.MY_CLIENTS', path: 'my-clients', icon: 'pi-users' },
      { labelKey: 'NAV.TRAINER.MY_GROUPS', path: 'my-groups', icon: 'pi-sitemap' },
      { labelKey: 'NAV.TRAINER.MY_SHIFTS', path: 'my-shifts', icon: 'pi-clock' },
    ],
  },
  {
    labelKey: 'NAV.ADMIN.GROUPS_LABELS.OPERATIONS',
    items: [
      { labelKey: 'NAV.ADMIN.DASHBOARD', path: 'dashboard', icon: 'pi-home', pageKey: 'dashboard' },
      {
        labelKey: 'NAV.ADMIN.SCHEDULE',
        path: 'schedule',
        icon: 'pi-calendar',
        pageKey: 'schedule',
      },
      {
        labelKey: 'NAV.ADMIN.SHIFTS',
        path: 'shifts',
        icon: 'pi-clock',
        pageKey: 'shifts',
      },
      {
        labelKey: 'NAV.ADMIN.COMPANIES',
        path: 'companies',
        icon: 'pi-map-marker',
        pageKey: 'companies',
      },
      {
        labelKey: 'NAV.ADMIN.CHECKOUT',
        path: 'checkout',
        icon: 'pi-credit-card',
        pageKey: 'checkout',
      },
      { labelKey: 'NAV.ADMIN.NOTIFICATIONS', path: 'notifications', icon: 'pi-bell', pageKey: 'notifications' },
    ],
  },
  {
    labelKey: 'NAV.ADMIN.GROUPS_LABELS.PEOPLE',
    items: [
      {
        labelKey: 'NAV.ADMIN.CLIENTS',
        path: 'clients',
        icon: 'pi-users',
        pageKey: 'clients',
      },
      {
        labelKey: 'NAV.ADMIN.EMPLOYEES',
        path: 'employees',
        icon: 'pi-id-card',
        pageKey: 'employees',
      },
      {
        labelKey: 'NAV.ADMIN.GROUPS',
        path: 'groups',
        icon: 'pi-sitemap',
        pageKey: 'groups',
      },
      { labelKey: 'NAV.ADMIN.COMMISSIONS', path: 'commissions', icon: 'pi-wallet', pageKey: 'commissions' },
    ],
  },
  {
    labelKey: 'NAV.ADMIN.GROUPS_LABELS.CATALOG',
    items: [
      {
        // Usluge i cjenik - one nav item hosting the Usluge/Paketi/Cjenik tabs, so
        // it needs any one of those three modules' grants.
        labelKey: 'NAV.ADMIN.SERVICES',
        path: 'services',
        icon: 'pi-tags',
        pageKey: 'services',
      },
      {
        // Proizvodi i zaliha - one nav item hosting the Proizvodi/Zaliha tabs,
        // same convention as Services above.
        labelKey: 'NAV.ADMIN.PRODUCTS',
        path: 'products',
        icon: 'pi-box',
        pageKey: 'products',
      },
    ],
  },
  {
    labelKey: 'NAV.ADMIN.GROUPS_LABELS.BUSINESS',
    items: [
      { labelKey: 'NAV.ADMIN.FINANCE', path: 'finance', icon: 'pi-wallet' },
      { labelKey: 'NAV.ADMIN.REPORTS', path: 'reports', icon: 'pi-chart-line' },
    ],
  },
  {
    labelKey: 'NAV.ADMIN.GROUPS_LABELS.WORKSPACE',
    items: [
      {
        labelKey: 'NAV.ADMIN.BRANDING',
        path: 'branding',
        icon: 'pi-palette',
        pageKey: 'branding',
      },
      { labelKey: 'NAV.ADMIN.PERMISSIONS', path: 'permissions', icon: 'pi-shield', ownerOnly: true },
    ],
  },
];
