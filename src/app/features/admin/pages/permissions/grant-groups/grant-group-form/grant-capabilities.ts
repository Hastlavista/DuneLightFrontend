/**
 * Frontend-only presentation layer over the backend's flat grant catalog
 * (GrantDto{key, module, description}, ~42 entries via GET /api/grants). The
 * backend stays exactly as granular as it is - this file's job is purely to
 * let an Owner think in terms of "can this person do X on page Y" instead of
 * raw grant keys, and to guarantee that enabling X always bundles whatever
 * OTHER raw grants the app actually needs to make X work end-to-end (a
 * required dropdown fed by a separately-gated lookup, most commonly).
 *
 * `primaryGrant` is the raw key that represents "this capability is on" (and
 * doubles as its unique id - every primaryGrant here is unique across the
 * whole catalog). `impliedGrants` are extra raw keys silently bundled in
 * alongside it whenever the capability is enabled, never shown as their own
 * row - see grant-group-form.component.ts's save/load logic for how the two
 * lists get reconciled with a plain raw grant array on the wire.
 *
 * Any raw grant returned by GET /api/grants that isn't referenced by any
 * capability below (either as a primaryGrant or an impliedGrant) - e.g. a
 * brand new backend grant this file hasn't been updated for yet - falls
 * through to grant-group-form's "Napredno" fallback section automatically
 * (see MANAGED_GRANT_KEYS), so nothing here can make a real grant
 * unreachable through the UI.
 */
export interface GrantCapability {
  /** The raw backend grant key this capability represents - also its unique id. */
  primaryGrant: string;
  /** Extra raw grant keys bundled in whenever this capability is enabled. */
  impliedGrants: string[];
  labelKey: string;
  descriptionKey: string;
}

export interface CapabilitySection {
  id: string;
  labelKey: string;
  capabilities: GrantCapability[];
}

export const CAPABILITY_SECTIONS: CapabilitySection[] = [
  {
    id: 'schedule',
    labelKey: 'PERMISSIONS.SECTIONS.SCHEDULE',
    capabilities: [
      {
        primaryGrant: 'appointments.view',
        impliedGrants: ['catalog.services.view', 'catalog.companies.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'appointments.write.own',
        impliedGrants: ['catalog.services.view', 'catalog.companies.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_WRITE_OWN.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_WRITE_OWN.DESCRIPTION',
      },
      {
        primaryGrant: 'appointments.write.all',
        impliedGrants: ['catalog.services.view', 'catalog.companies.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_WRITE_ALL.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_WRITE_ALL.DESCRIPTION',
      },
      {
        primaryGrant: 'appointments.delete',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_DELETE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.APPOINTMENTS_DELETE.DESCRIPTION',
      },
      {
        primaryGrant: 'schedule.breaks.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.SCHEDULE_BREAKS_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.SCHEDULE_BREAKS_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'schedule.breaks.write.own',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.SCHEDULE_BREAKS_WRITE_OWN.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.SCHEDULE_BREAKS_WRITE_OWN.DESCRIPTION',
      },
      {
        primaryGrant: 'schedule.breaks.write.all',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.SCHEDULE_BREAKS_WRITE_ALL.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.SCHEDULE_BREAKS_WRITE_ALL.DESCRIPTION',
      },
    ],
  },
  {
    id: 'shifts',
    labelKey: 'PERMISSIONS.SECTIONS.SHIFTS',
    capabilities: [
      {
        primaryGrant: 'roster.types.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TYPES_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TYPES_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'roster.types.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TYPES_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TYPES_MANAGE.DESCRIPTION',
      },
    ],
  },
  {
    id: 'companies',
    labelKey: 'PERMISSIONS.SECTIONS.COMPANIES',
    capabilities: [
      {
        primaryGrant: 'catalog.companies.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CATALOG_COMPANIES_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CATALOG_COMPANIES_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'catalog.companies.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CATALOG_COMPANIES_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CATALOG_COMPANIES_MANAGE.DESCRIPTION',
      },
      {
        primaryGrant: 'catalog.rooms.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CATALOG_ROOMS_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CATALOG_ROOMS_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'catalog.rooms.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CATALOG_ROOMS_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CATALOG_ROOMS_MANAGE.DESCRIPTION',
      },
    ],
  },
  {
    id: 'working-hours',
    labelKey: 'PERMISSIONS.SECTIONS.WORKING_HOURS',
    capabilities: [
      {
        primaryGrant: 'roster.templates.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TEMPLATES_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TEMPLATES_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'roster.templates.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TEMPLATES_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_TEMPLATES_MANAGE.DESCRIPTION',
      },
    ],
  },
  {
    id: 'clients',
    labelKey: 'PERMISSIONS.SECTIONS.CLIENTS',
    capabilities: [
      {
        primaryGrant: 'clients.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'clients.manage',
        impliedGrants: ['catalog.companies.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_MANAGE.DESCRIPTION',
      },
      {
        primaryGrant: 'clients.status.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_STATUS_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_STATUS_MANAGE.DESCRIPTION',
      },
      {
        primaryGrant: 'clients.anonymize',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_ANONYMIZE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_ANONYMIZE.DESCRIPTION',
      },
      {
        primaryGrant: 'clients.tags.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_TAGS_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_TAGS_MANAGE.DESCRIPTION',
      },
      {
        primaryGrant: 'clients.packages.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_PACKAGES_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CLIENTS_PACKAGES_MANAGE.DESCRIPTION',
      },
    ],
  },
  {
    id: 'employees',
    labelKey: 'PERMISSIONS.SECTIONS.EMPLOYEES',
    capabilities: [
      {
        primaryGrant: 'employees.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.EMPLOYEES_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.EMPLOYEES_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'employees.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.EMPLOYEES_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.EMPLOYEES_MANAGE.DESCRIPTION',
      },
      {
        primaryGrant: 'employees.engagement-types.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.EMPLOYEES_ENGAGEMENT_TYPES_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.EMPLOYEES_ENGAGEMENT_TYPES_MANAGE.DESCRIPTION',
      },
      {
        primaryGrant: 'roster.leave-fund.settings.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_SETTINGS_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_SETTINGS_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'roster.leave-fund.settings.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_SETTINGS_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_SETTINGS_MANAGE.DESCRIPTION',
      },
      {
        primaryGrant: 'roster.leave-fund.view.own',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_VIEW_OWN.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_VIEW_OWN.DESCRIPTION',
      },
      {
        primaryGrant: 'roster.leave-fund.view.all',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_VIEW_ALL.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ROSTER_LEAVE_FUND_VIEW_ALL.DESCRIPTION',
      },
    ],
  },
  {
    id: 'groups',
    labelKey: 'PERMISSIONS.SECTIONS.GROUPS',
    capabilities: [
      {
        primaryGrant: 'groups.view',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.GROUPS_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.GROUPS_VIEW.DESCRIPTION',
      },
      {
        // Grupe's trainer picker uses EmployeesService.getDirectory() (see
        // group-form.component.ts), not getPage() - that endpoint requires no
        // grant at all (any authenticated role may call it), so unlike
        // services/companies below it needs no implied grant here.
        primaryGrant: 'groups.manage',
        impliedGrants: ['catalog.services.view', 'catalog.companies.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.GROUPS_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.GROUPS_MANAGE.DESCRIPTION',
      },
    ],
  },
  {
    id: 'catalog-items',
    labelKey: 'PERMISSIONS.SECTIONS.CATALOG_ITEMS',
    capabilities: [
      {
        primaryGrant: 'catalog.services.view',
        impliedGrants: ['catalog.packages.view', 'catalog.price-list.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.CATALOG_SERVICES_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CATALOG_SERVICES_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'catalog.services.manage',
        impliedGrants: ['catalog.packages.manage', 'catalog.price-list.manage'],
        labelKey: 'PERMISSIONS.CAPABILITIES.CATALOG_SERVICES_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CATALOG_SERVICES_MANAGE.DESCRIPTION',
      },
    ],
  },
  {
    id: 'organization',
    labelKey: 'PERMISSIONS.SECTIONS.ORGANIZATION',
    capabilities: [
      {
        primaryGrant: 'organization.branding.manage',
        impliedGrants: [],
        labelKey: 'PERMISSIONS.CAPABILITIES.ORGANIZATION_BRANDING_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.ORGANIZATION_BRANDING_MANAGE.DESCRIPTION',
      },
    ],
  },
  {
    id: 'checkout',
    labelKey: 'PERMISSIONS.SECTIONS.CHECKOUT',
    capabilities: [
      {
        primaryGrant: 'checkout.view',
        // Viewing a Checkout means viewing its items, which reference
        // Bookings/Packages/Products - bundle in the read grants the item
        // picker/detail screen needs end-to-end, same rationale as
        // groups.manage bundling catalog.services.view/catalog.companies.view.
        impliedGrants: ['appointments.view', 'catalog.packages.view', 'products.view', 'stock.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.CHECKOUT_VIEW.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CHECKOUT_VIEW.DESCRIPTION',
      },
      {
        primaryGrant: 'checkout.manage',
        impliedGrants: ['appointments.view', 'catalog.packages.view', 'products.view', 'stock.view'],
        labelKey: 'PERMISSIONS.CAPABILITIES.CHECKOUT_MANAGE.LABEL',
        descriptionKey: 'PERMISSIONS.CAPABILITIES.CHECKOUT_MANAGE.DESCRIPTION',
      },
    ],
  },
];

export const ALL_CAPABILITIES: GrantCapability[] = CAPABILITY_SECTIONS.flatMap((section) => section.capabilities);

/** Every raw grant key claimed by some capability above, either as its
 * primaryGrant or as one of its impliedGrants - anything else in the live
 * catalog falls through to the "Napredno" fallback section untouched. */
export const MANAGED_GRANT_KEYS: Set<string> = new Set(
  ALL_CAPABILITIES.flatMap((capability) => [capability.primaryGrant, ...capability.impliedGrants]),
);
