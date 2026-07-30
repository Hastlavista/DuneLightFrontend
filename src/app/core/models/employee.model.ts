import { UserRole } from './role';

export interface EmployeeLocation {
  locationId: string;
  locationName: string;
  isPrimary: boolean;
}

export interface CurrentEmployee {
  employeeId: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  colorHex: string | null;
  locations: EmployeeLocation[];
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
 * `locations` here is a flat array of location NAMES, not the full
 * `EmployeeLocation[]` the admin EmployeeDto carries (no ids, no isPrimary) -
 * a real difference from EmployeeDto, not just a subset, so anything that
 * needs to match by location id (see ScheduleDayGridComponent's columns) must
 * resolve these names against an already-fetched location list first, it
 * can't rely on structural compatibility with EmployeeDto for that field.
 * Trainer-facing screens (my-week, today, my-shifts, my-clients) must use this
 * instead of EmployeesService.getPage(). */
export interface EmployeeDirectoryDto {
  id: string;
  firstName: string;
  lastName: string;
  colorHex?: string | null;
  isActive: boolean;
  locations: string[];
}

/** Minimal shape the appointment/roster-entry dialogs and personal-roster
 * picker actually need to render a name option - satisfied structurally by
 * both the full EmployeeDto and the lighter EmployeeDirectoryDto above, so
 * these shared components can be fed either without duplicating them per
 * section (admin passes EmployeeDto[], trainer screens pass
 * EmployeeDirectoryDto[]). Deliberately excludes `locations` - EmployeeDto and
 * EmployeeDirectoryDto disagree on that field's shape (objects vs. plain
 * names), see EmployeeColumnEntry for the one place that needs it. */
export interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
}

/** Normalized shape ScheduleDayGridComponent needs for its "day x every
 * trainer" columns, filterable by the globally-selected location id
 * (LocationContextService.selectedLocationId). Each host maps its own
 * employee source into this: admin's ScheduleComponent has the full
 * EmployeeDto (locations already carry a locationId), the trainer's
 * TodayComponent has the lighter EmployeeDirectoryDto (locations are plain
 * names only) and must resolve those names to ids against its own
 * already-fetched location list first - see each component's own mapping. */
export interface EmployeeColumnEntry {
  id: string;
  firstName: string;
  lastName: string;
  locationIds: string[];
}

/** GET /api/employees/{id} and the items of its paged list. `warning` is
 * transient - only ever populated in the response of PATCH activate/deactivate
 * (e.g. "Zaposlenik ima buduće termine."), never on a plain GET. */
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
  locations: EmployeeLocation[];
  services: EmployeeServiceLink[];
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  warning: string | null;
}

/** Body for POST /api/employees/with-login - the only create path the UI uses
 * (POST /api/employees without a login exists on the backend but expects an
 * already-existing userId and is intentionally not exposed here). `email`
 * doubles as contact email and login email. Empty `serviceIds` means the
 * employee may perform ALL services - intentional, not an omission. The backend
 * rejects a `primaryLocationId` that isn't also in `locationIds`
 * (VALIDATION_ERROR) - the form blocks that first. */
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
  locationIds: string[];
  primaryLocationId: string;
  serviceIds: string[];
  password: string;
  role: UserRole;
}

/** Response of POST /api/employees/with-login - NOT a full EmployeeDto. */
export interface EmployeeWithLoginResponse {
  employeeId: string;
  userId: string;
  email: string;
  role: UserRole;
}

/** Body for PUT /api/employees/{id} - same shape as EmployeeWithLoginRequest
 * minus password/role/userId (the login isn't touched here - see
 * EmployeesService.changeRole for role changes). Full-replace for
 * `locationIds`/`serviceIds`, same convention as Paketi's `services`. */
export type EmployeeUpsertRequest = Omit<EmployeeWithLoginRequest, 'password' | 'role'>;

/** Body for PATCH /api/employees/{id}/role. */
export interface EmployeeRoleUpdateRequest {
  role: UserRole;
}
