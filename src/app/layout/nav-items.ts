export interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { labelKey: 'NAV.ADMIN.DASHBOARD', path: 'dashboard', icon: 'pi-home' },
  { labelKey: 'NAV.ADMIN.LOCATIONS', path: 'locations', icon: 'pi-map-marker' },
  { labelKey: 'NAV.ADMIN.SCHEDULE', path: 'schedule', icon: 'pi-calendar' },
  { labelKey: 'NAV.ADMIN.SHIFTS', path: 'shifts', icon: 'pi-clock' },
  { labelKey: 'NAV.ADMIN.CLIENTS', path: 'clients', icon: 'pi-users' },
  { labelKey: 'NAV.ADMIN.EMPLOYEES', path: 'employees', icon: 'pi-id-card' },
  { labelKey: 'NAV.ADMIN.GROUPS', path: 'groups', icon: 'pi-sitemap' },
  { labelKey: 'NAV.ADMIN.SERVICES', path: 'services', icon: 'pi-tags' },
  { labelKey: 'NAV.ADMIN.FINANCE', path: 'finance', icon: 'pi-wallet' },
  { labelKey: 'NAV.ADMIN.REPORTS', path: 'reports', icon: 'pi-chart-line' },
  { labelKey: 'NAV.ADMIN.PROFILE', path: 'profile', icon: 'pi-user' },
];

export const TRAINER_NAV_ITEMS: NavItem[] = [
  { labelKey: 'NAV.TRAINER.MY_WEEK', path: 'my-week', icon: 'pi-calendar' },
  { labelKey: 'NAV.TRAINER.TODAY_ALL', path: 'today', icon: 'pi-calendar-clock' },
  { labelKey: 'NAV.TRAINER.MY_CLIENTS', path: 'my-clients', icon: 'pi-users' },
  { labelKey: 'NAV.TRAINER.MY_GROUPS', path: 'my-groups', icon: 'pi-sitemap' },
  { labelKey: 'NAV.TRAINER.MY_SHIFTS', path: 'my-shifts', icon: 'pi-clock' },
  { labelKey: 'NAV.TRAINER.MY_PROFILE', path: 'profile', icon: 'pi-user' },
];
