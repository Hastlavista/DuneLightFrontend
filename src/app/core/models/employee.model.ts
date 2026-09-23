import { WarningDto } from './api-error.model';
import { UserRole } from './role';

export interface EmployeeCompany {
  companyId: string;
  companyName: string;
  isPrimary: boolean;
}

/** Authorization belongs to the User (see `grants`' own doc); the Employee
 * profile fields below are an optional, separate business/workforce profile -
 * `false` only ever for the organization's founder, right after Register and
 * before they complete their own profile (see hasProfile()/hasGrant() in
 * current-employee.service.ts and CompleteEmployeeProfileCtaComponent, the
 * sole consumer that treats this as "show the CTA"). No Owner/founder bypass
 * anywhere - `grants` is populated from the real Admin starter GrantGroup
 * assignment either way (see AuthService.Register on the backend). */
export interface CurrentEmployee {
  hasProfile: boolean;
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  /** Effective, aggregated union of grant keys from every GrantGroup this user
   * is assigned - same source the backend's RequireGrant check uses
   * (GrantGroupHandler.ResolveEffective), just exposed for UI-level checks
   * (see hasGrant/hasAnyGrant in current-employee.service.ts). Always
   * populated once loaded, regardless of hasProfile - the organization's
   * founder gets their real grants here too, through the Admin starter
   * GrantGroup assigned at registration - there is no Owner bypass anywhere
   * in the system (Residual IsOwner Removal). */
  grants: string[];
  colorHex: string | null;
  companies: EmployeeCompany[];
  /** Whether this user has a PIN set for fast device switching (PinLogin) -
   * drives Profile's "Postavi PIN" vs "Promijeni PIN" section choice. A
   * User-level property (PinHash lives on User), so populated even without
   * an Employee profile. */
  hasPinSet: boolean;
}

/** One service an employee is qualified to perform, as returned by GET. */
export interface EmployeeServiceLink {
  serviceId: string;
  serviceName: string;
}

/** GET /api/employees/directory (paged, same PagedResult envelope as every
 * other list endpoint - see EmployeesService.getDirectory, which unwraps it) -
 * the "kolegijalni pogled" every logged-in role (Admin, Member, Reception) may
 * call, unlike the full /api/employees (Admin-only, 403s otherwise).
 * Deliberately excludes anything sensitive (email, phone, OIB, compensation
 * note, ...) - just enough to render a trainer's name/color in a schedule
 * grid, filter dropdown, or picker. `colorHex` is omitted entirely (not even
 * `null`) when the employee has none - always read it via `?? null`.
 * `companies` here is a flat array of company NAMES, not the full
 * `EmployeeCompany[]` the admin EmployeeDto carries (no ids, no isPrimary) -
 * a real difference from EmployeeDto, not just a subset, so anything that
 * needs to match by company id (see ScheduleDayGridComponent's columns) must
 * resolve these names against an already-fetched company list first, it
 * can't rely on structural compatibility with EmployeeDto for that field.
 * Trainer-facing screens (my-week, today, my-shifts, my-clients) must use this
 * instead of EmployeesService.getPage(). */
export interface EmployeeDirectoryDto {
  id: string;
  firstName: string;
  lastName: string;
  colorHex?: string | null;
  isActive: boolean;
  companies: string[];
}

/** Minimal shape the appointment/roster-entry dialogs and personal-roster
 * picker actually need to render a name option - satisfied structurally by
 * both the full EmployeeDto and the lighter EmployeeDirectoryDto above, so
 * these shared components can be fed either without duplicating them per
 * section (admin passes EmployeeDto[], trainer screens pass
 * EmployeeDirectoryDto[]). Deliberately excludes `companies` - EmployeeDto and
 * EmployeeDirectoryDto disagree on that field's shape (objects vs. plain
 * names), see EmployeeColumnEntry for the one place that needs it. */
export interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
}

/** Normalized shape ScheduleDayGridComponent needs for its "day x every
 * trainer" columns, filterable by the globally-selected company (matched by
 * NAME, not id - see ScheduleDayGridComponent's `columns`). Names are the
 * join key on purpose: EmployeeDirectoryDto only ever carries company names
 * (see its own doc comment), so requiring ids here would force every
 * trainer-facing screen to fetch the full company catalog (gated behind
 * `catalog.companies.view`) just to resolve a name->id map - if that grant
 * happened to be missing from a role's GrantGroup, the resolution would
 * silently fail for every employee and the grid would render with zero
 * columns. Matching by name avoids that dependency entirely; it relies on
 * company names being unique within a tenant, which the rest of the app
 * already assumes (e.g. TodayComponent's employeeColumns previously joined
 * on name for the same reason). Each host maps its own employee source into
 * this: admin's ScheduleComponent has the full EmployeeDto (companies carry
 * `companyName`), the trainer's TodayComponent has the lighter
 * EmployeeDirectoryDto (companies are plain names already) - see each
 * component's own mapping. */
export interface EmployeeColumnEntry {
  id: string;
  firstName: string;
  lastName: string;
  companyNames: string[];
}

/** GET /api/employees/{id} and the items of its paged list. `warning` is
 * transient - only ever populated in the response of PATCH activate/deactivate
 * (EMPLOYEE_HAS_FUTURE_APPOINTMENTS, see WarningDto), never on a plain GET. */
export interface EmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  oib: string | null;
  note: string | null;
  compensationNote: string | null;
  colorHex: string | null;
  sortOrder: number;
  employmentStartDate: string;
  employmentEndDate: string | null;
  engagementTypeId: string;
  engagementTypeName: string | null;
  isActive: boolean;
  userId: string;
  role: UserRole | null;
  /** GrantGroup/Role names (not ids) currently assigned to this employee's
   * user - bulk-fetched server-side so the list screen doesn't need a
   * per-row lookup (see EmployeeListComponent). */
  grantGroupNames: string[];
  roleNames: string[];
  companies: EmployeeCompany[];
  services: EmployeeServiceLink[];
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  warning: WarningDto | null;
}

/** Body for POST /api/employees/with-login - the only create path the UI uses
 * (POST /api/employees without a login exists on the backend but expects an
 * already-existing userId and is intentionally not exposed here). `email`
 * doubles as contact email and login email. Empty `serviceIds` means the
 * employee may perform ALL services - intentional, not an omission. The backend
 * rejects a `primaryCompanyId` that isn't also in `companyIds`
 * (VALIDATION_ERROR) - the form blocks that first. `grantGroupIds` is required
 * (min 1) - every employee needs at least one GrantGroup to be able to do
 * anything; `roleIds` (business-facing tags, e.g. "Trener") is optional and
 * does not affect authorization. `mustChangeCredentialsOnFirstLogin`/`pin` are
 * accepted by the backend but not exposed in the form - always sent as
 * false/omitted. */
export interface EmployeeWithLoginRequest {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  dateOfBirth: string | null;
  address: string | null;
  oib: string | null;
  note: string | null;
  compensationNote: string | null;
  colorHex: string | null;
  sortOrder: number;
  employmentStartDate: string;
  employmentEndDate: string | null;
  engagementTypeId: string;
  companyIds: string[];
  primaryCompanyId: string;
  serviceIds: string[];
  password: string;
  mustChangeCredentialsOnFirstLogin: boolean;
  pin: string | null;
  grantGroupIds: string[];
  roleIds: string[];
}

/** Response of POST /api/employees/with-login - NOT a full EmployeeDto. */
export interface EmployeeWithLoginResponse {
  employeeId: string;
  userId: string;
  email: string;
  grantGroupIds: string[];
}

/** Body for PUT /api/employees/{id} - same shape as EmployeeWithLoginRequest
 * minus password/login-only/permission-assignment fields (the login isn't
 * touched here; GrantGroup/Role assignment goes through their own dedicated
 * assignment endpoints - see PermissionsService). Full-replace for
 * `companyIds`/`serviceIds`, same convention as Paketi's `services`. */
export type EmployeeUpsertRequest = Omit<
  EmployeeWithLoginRequest,
  'password' | 'mustChangeCredentialsOnFirstLogin' | 'pin' | 'grantGroupIds' | 'roleIds'
>;

/** Body for POST /api/employees (no `-login` suffix) - frontend #15's "dovrši
 * svoj profil" flow, the ONLY UI caller of this endpoint. Unlike
 * createWithLogin(), `userId` is the already-logged-in founder's own id (from
 * AuthService.currentUser, never entered in the form) rather than a new
 * login being created - so there's no password/mustChangeCredentialsOnFirstLogin/pin,
 * and no grantGroupIds/roleIds either - this endpoint deliberately never
 * touches GrantGroups (self-service profile completion, not a permissions
 * editor); the founder already got their real grants at registration through
 * the Admin starter GrantGroup, no bypass involved. `email` is contact-only
 * here, same as everywhere else in EmployeeDto - never the account's login
 * email. */
export type CompleteOwnEmployeeRequest = Omit<
  EmployeeUpsertRequest,
  'email'
> & {
  userId: string;
  email: string | null;
};
