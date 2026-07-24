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
