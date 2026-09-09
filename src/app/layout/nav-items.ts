export interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
  /** When true, only shown to the organization's Owner (see ownerGuard, which
   * enforces this server-side too - hiding it here is purely a UX nicety). */
  ownerOnly?: boolean;
  /** OR-matched against CurrentEmployeeService.hasAnyGrant() - same semantics
   * as the backend's [RequireGrant]/ADMIN_AREA_GRANTS. Unlike
   * ADMIN_AREA_GRANTS (which only cares about `.manage` grants - "does this
   * user have ANY reason to be in /admin"), this includes each screen's
   * `.view` grant too, so a view-only user still sees the item and can look
   * even though most of that screen's action buttons would 403 for them
   * (per-action gating is a separate, not-yet-done pass - see EMPLOYEES.md
   * conversation). Omit entirely for items every admin-area user should see
   * regardless (Dashboard, Financije/Izvješća - no grant exists for either
   * yet).
   */
  requiredGrants?: string[];
}

export interface NavGroup {
  /** Section header translation key. Omit for an ungrouped list (no header rendered). */
  labelKey?: string;
  items: NavItem[];
}

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'NAV.ADMIN.GROUPS_LABELS.OPERATIONS',
    items: [
      { labelKey: 'NAV.ADMIN.DASHBOARD', path: 'dashboard', icon: 'pi-home' },
      {
        labelKey: 'NAV.ADMIN.SCHEDULE',
        path: 'schedule',
        icon: 'pi-calendar',
        requiredGrants: ['appointments.view', 'appointments.write.own', 'appointments.write.all'],
      },
      {
        labelKey: 'NAV.ADMIN.SHIFTS',
        path: 'shifts',
        icon: 'pi-clock',
        requiredGrants: ['roster.types.view', 'roster.types.manage'],
      },
      {
        labelKey: 'NAV.ADMIN.COMPANIES',
        path: 'companies',
        icon: 'pi-map-marker',
        requiredGrants: [
          'catalog.companies.view',
          'catalog.companies.manage',
          'catalog.rooms.view',
          'catalog.rooms.manage',
        ],
      },
    ],
  },
  {
    labelKey: 'NAV.ADMIN.GROUPS_LABELS.PEOPLE',
    items: [
      {
        labelKey: 'NAV.ADMIN.CLIENTS',
        path: 'clients',
        icon: 'pi-users',
        requiredGrants: ['clients.view', 'clients.manage', 'clients.status.manage', 'clients.anonymize'],
      },
      {
        labelKey: 'NAV.ADMIN.EMPLOYEES',
        path: 'employees',
        icon: 'pi-id-card',
        requiredGrants: ['employees.view', 'employees.manage'],
      },
      {
        labelKey: 'NAV.ADMIN.GROUPS',
        path: 'groups',
        icon: 'pi-sitemap',
        requiredGrants: ['groups.view', 'groups.manage'],
      },
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
        requiredGrants: [
          'catalog.services.view',
          'catalog.services.manage',
          'catalog.packages.view',
          'catalog.packages.manage',
          'catalog.price-list.view',
          'catalog.price-list.manage',
        ],
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
      { labelKey: 'NAV.ADMIN.PERMISSIONS', path: 'permissions', icon: 'pi-shield', ownerOnly: true },
    ],
  },
];

export const TRAINER_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { labelKey: 'NAV.TRAINER.MY_WEEK', path: 'my-week', icon: 'pi-calendar' },
      { labelKey: 'NAV.TRAINER.TODAY_ALL', path: 'today', icon: 'pi-calendar-clock' },
      { labelKey: 'NAV.TRAINER.MY_CLIENTS', path: 'my-clients', icon: 'pi-users' },
      { labelKey: 'NAV.TRAINER.MY_GROUPS', path: 'my-groups', icon: 'pi-sitemap' },
      { labelKey: 'NAV.TRAINER.MY_SHIFTS', path: 'my-shifts', icon: 'pi-clock' },
    ],
  },
];
