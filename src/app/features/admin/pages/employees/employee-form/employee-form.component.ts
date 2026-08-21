import { Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Textarea } from 'primeng/textarea';
import { Observable, finalize, forkJoin, of } from 'rxjs';
import {
  EmployeeDto,
  EmployeeLocation,
  EmployeeServiceLink,
  EmployeeUpsertRequest,
  EmployeeWithLoginRequest,
} from '../../../../../core/models/employee.model';
import { EngagementTypeDto } from '../../../../../core/models/engagement-type.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { GrantGroupDto, RoleDto } from '../../../../../core/models/permissions.model';
import { ServiceDto } from '../../../../../core/models/service.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { EngagementTypesService } from '../../../../../core/services/engagement-types.service';
import { GrantGroupsService } from '../../../../../core/services/grant-groups.service';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PermissionRolesService } from '../../../../../core/services/permission-roles.service';
import { ServicesService } from '../../../../../core/services/services.service';
import { toStartOfDayIso } from '../../../../../core/utils/date.util';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { WorkingHoursTemplateEditorComponent } from '../../../../../shared/components/working-hours-template-editor/working-hours-template-editor.component';
import { EmployeeLeaveFundTabComponent } from './employee-leave-fund-tab.component';

/** Route param sentinel for create mode - see admin.routes.ts ('employees/:id'
 * instead of a separate 'new' route), same convention as Paketi. */
const NEW_ID = 'new';

/** pageSize max is 200 - fetches the full active set in one page for the
 * location/service/engagement-type pickers. */
const LOOKUP_PAGE_SIZE = 200;

export interface EmployeeOption {
  id: string;
  name: string;
}

/** Array-level: at least one location must be selected. */
function requiredLocationsValidator(control: AbstractControl): ValidationErrors | null {
  const ids = (control.value as string[]) ?? [];
  return ids.length > 0 ? null : { required: true };
}

/** OIB is optional, but if present must be exactly 11 digits. */
function oibValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string | null;
  if (!value) {
    return null;
  }
  return /^\d{11}$/.test(value) ? null : { oibInvalid: true };
}

/** Group-level: the primary location must be one of the selected locations -
 * the backend enforces this too (VALIDATION_ERROR) but the form blocks it
 * first. */
function primaryLocationValidator(group: AbstractControl): ValidationErrors | null {
  const locationIds = (group.get('locationIds')?.value as string[]) ?? [];
  const primaryLocationId = group.get('primaryLocationId')?.value as string | null;
  return primaryLocationId && locationIds.includes(primaryLocationId) ? null : { primaryNotSelected: true };
}

/** Group-level: employment end can't be before employment start. */
function employmentDatesValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('employmentStartDate')?.value as Date | null;
  const end = group.get('employmentEndDate')?.value as Date | null;
  return start && end && end < start ? { employmentEndBeforeStart: true } : null;
}

@Component({
  selector: 'app-admin-employee-form',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    InputNumber,
    Select,
    MultiSelect,
    DatePicker,
    ColorPicker,
    Password,
    Button,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    WorkingHoursTemplateEditorComponent,
    EmployeeLeaveFundTabComponent,
  ],
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss',
})
export class EmployeeFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeesService = inject(EmployeesService);
  private readonly locationsService = inject(LocationsService);
  private readonly servicesService = inject(ServicesService);
  private readonly engagementTypesService = inject(EngagementTypesService);
  private readonly grantGroupsService = inject(GrantGroupsService);
  private readonly rolesService = inject(PermissionRolesService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** "Radno vrijeme" tab only makes sense once the employee actually has an id
   * (the template endpoint is keyed by employeeId) and only for someone with a
   * reason to see it - roster.templates is a grant of its own, independent of
   * employees.manage (see WorkingHoursTemplateEditorComponent's own doc). */
  readonly canViewWorkingHours = computed(() =>
    this.currentEmployeeService.hasAnyGrant(['roster.templates.view', 'roster.templates.manage']),
  );

  /** "Godišnji odmor" tab (frontend #18) - same edit-mode-only rationale as
   * canViewWorkingHours (both leave-settings and leave-funds endpoints are
   * keyed by employeeId), gated on any grant that gets you into the tab at
   * all; EmployeeLeaveFundTabComponent itself further splits settings vs.
   * funds visibility (see its own doc). */
  readonly canViewLeaveFund = computed(() =>
    this.currentEmployeeService.hasAnyGrant([
      'roster.leave-fund.settings.view',
      'roster.leave-fund.settings.manage',
      'roster.leave-fund.view.own',
      'roster.leave-fund.view.all',
    ]),
  );

  readonly activeLocations = signal<LocationDto[]>([]);
  readonly activeServices = signal<ServiceDto[]>([]);
  readonly activeEngagementTypes = signal<EngagementTypeDto[]>([]);
  readonly activeGrantGroups = signal<GrantGroupDto[]>([]);
  readonly activeRoles = signal<RoleDto[]>([]);

  /** Locations/services/engagement type linked to the employee being edited
   * that have since been deactivated - kept visible in their picker (with a
   * badge) instead of silently dropped. Derived, not set directly, so it stays
   * correct regardless of whether the employee or the active-list fetch
   * finishes loading first (see PackageFormComponent for the same pattern). */
  private readonly loadedEmployeeLocations = signal<EmployeeLocation[]>([]);
  private readonly loadedEmployeeServices = signal<EmployeeServiceLink[]>([]);
  private readonly loadedEmployeeEngagementType = signal<EmployeeOption | null>(null);

  /** The User.Id behind the employee being edited - GrantGroup/Role assignment
   * endpoints key by userId, NOT the employee id this whole form otherwise
   * navigates by (see EmployeeDto.userId). */
  private readonly loadedUserId = signal<string | null>(null);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly locationOptions = computed<EmployeeOption[]>(() => this.mergeOptions(
    this.activeLocations().map((location) => ({ id: location.id, name: location.name })),
    this.loadedEmployeeLocations().map((link) => ({ id: link.companyId, name: link.companyName })),
  ));

  readonly serviceOptions = computed<EmployeeOption[]>(() => this.mergeOptions(
    this.activeServices().map((service) => ({ id: service.id, name: service.name })),
    this.loadedEmployeeServices().map((link) => ({ id: link.serviceId, name: link.serviceName })),
  ));

  readonly engagementTypeOptions = computed<EmployeeOption[]>(() => {
    const loaded = this.loadedEmployeeEngagementType();
    return this.mergeOptions(
      this.activeEngagementTypes().map((type) => ({ id: type.id, name: type.name })),
      loaded ? [loaded] : [],
    );
  });

  readonly grantGroupOptions = computed<EmployeeOption[]>(() =>
    this.activeGrantGroups().map((group) => ({ id: group.id, name: group.name })),
  );

  readonly roleOptions = computed<EmployeeOption[]>(() =>
    this.activeRoles().map((role) => ({ id: role.id, name: role.name })),
  );

  /** Owner editing their own Employee record - GrantGroups are meaningless for
   * the Owner (see Grants.cs: IsOwner bypasses every check), so the field is
   * hidden entirely rather than shown as an always-invalid required multiselect. */
  readonly isSelfOwnerEdit = computed(() => {
    const employee = this.currentEmployeeService.employee();
    const id = this.editingId();
    return !!employee?.isOwner && !!id && employee.employeeId === id;
  });

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(255)]],
      lastName: ['', [Validators.required, Validators.maxLength(255)]],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      dateOfBirth: this.fb.control<Date | null>(null),
      address: [''],
      oib: ['', oibValidator],
      note: [''],
      compensationNote: [''],
      colorHex: [''],
      sortOrder: [0],
      employmentStartDate: this.fb.control<Date | null>(null, Validators.required),
      employmentEndDate: this.fb.control<Date | null>(null),
      engagementTypeId: ['', Validators.required],
      locationIds: this.fb.nonNullable.control<string[]>([], requiredLocationsValidator),
      primaryLocationId: this.fb.control<string | null>(null),
      serviceIds: this.fb.nonNullable.control<string[]>([]),
      password: [''],
      grantGroupIds: this.fb.nonNullable.control<string[]>([]),
      roleIds: this.fb.nonNullable.control<string[]>([]),
    },
    { validators: [primaryLocationValidator, employmentDatesValidator] },
  );

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam && idParam !== NEW_ID ? idParam : null;
    this.editingId.set(id);

    this.loadActiveLocations();
    this.loadActiveServices();
    this.loadActiveEngagementTypes();
    this.loadActiveGrantGroups();
    this.loadActiveRoles();

    if (id) {
      this.loadEmployee(id);
    } else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
      this.form.controls.password.updateValueAndValidity();
    }

    // GrantGroups are required for every employee except the Owner editing
    // their own record (see isSelfOwnerEdit) - reactive rather than set once,
    // since isSelfOwnerEdit can only be known once CurrentEmployeeService's
    // async /me load resolves.
    effect(() => {
      const control = this.form.controls.grantGroupIds;
      if (this.isSelfOwnerEdit()) {
        control.clearValidators();
      } else {
        control.setValidators(requiredGrantGroupsValidator);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });

    // If the user deselects the current primary location from the multiselect,
    // don't leave a now-invalid primaryLocationId silently selected.
    this.form.controls.locationIds.valueChanges.subscribe((ids) => {
      const primary = this.form.controls.primaryLocationId.value;
      if (primary && !ids.includes(primary)) {
        this.form.controls.primaryLocationId.setValue(null);
      }
    });
  }

  /** Options for the primary-location select: only locations currently picked
   * in the locationIds multiselect. */
  primaryLocationOptions(): EmployeeOption[] {
    const selected = new Set(this.form.controls.locationIds.value);
    return this.locationOptions().filter((option) => selected.has(option.id));
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    this.saving.set(true);

    if (id) {
      const userId = this.loadedUserId();
      this.employeesService
        .update(id, this.toUpsertRequest())
        .subscribe({
          next: () => {
            const raw = this.form.getRawValue();
            const assignments$: Observable<unknown> = userId
              ? forkJoin([
                  this.isSelfOwnerEdit()
                    ? of(null)
                    : this.grantGroupsService.setAssignments(userId, { grantGroupIds: raw.grantGroupIds }),
                  this.rolesService.setAssignments(userId, { roleIds: raw.roleIds }),
                ])
              : of(null);
            assignments$.pipe(finalize(() => this.saving.set(false))).subscribe({
              next: () => {
                this.notifications.showSuccess(this.translate.instant('EMPLOYEES.UPDATED'));
                this.navigateBack();
              },
              error: () => {},
            });
          },
          error: () => this.saving.set(false),
        });
    } else {
      this.employeesService
        .createWithLogin(this.toWithLoginRequest())
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('EMPLOYEES.CREATED'));
            this.navigateBack();
          },
          error: () => {},
        });
    }
  }

  onCancel(): void {
    this.navigateBack();
  }

  private mergeOptions(active: EmployeeOption[], linked: EmployeeOption[]): EmployeeOption[] {
    this.translationsReady();
    const activeIds = new Set(active.map((option) => option.id));
    const badge = this.translate.instant('EMPLOYEES.INACTIVE_BADGE');
    const grandfathered = linked
      .filter((option) => !activeIds.has(option.id))
      .map((option) => ({ id: option.id, name: `${option.name} (${badge})` }));
    return [...active, ...grandfathered];
  }

  private toCommonRequest(): EmployeeUpsertRequest {
    const raw = this.form.getRawValue();
    return {
      firstName: raw.firstName,
      lastName: raw.lastName,
      phone: raw.phone || null,
      email: raw.email,
      dateOfBirth: raw.dateOfBirth ? toStartOfDayIso(raw.dateOfBirth) : null,
      address: raw.address || null,
      oib: raw.oib || null,
      note: raw.note || null,
      compensationNote: raw.compensationNote || null,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      sortOrder: raw.sortOrder,
      employmentStartDate: toStartOfDayIso(raw.employmentStartDate as Date),
      employmentEndDate: raw.employmentEndDate ? toStartOfDayIso(raw.employmentEndDate) : null,
      engagementTypeId: raw.engagementTypeId,
      companyIds: raw.locationIds,
      primaryCompanyId: raw.primaryLocationId as string,
      serviceIds: raw.serviceIds,
    };
  }

  private toUpsertRequest(): EmployeeUpsertRequest {
    return this.toCommonRequest();
  }

  private toWithLoginRequest(): EmployeeWithLoginRequest {
    const raw = this.form.getRawValue();
    return {
      ...this.toCommonRequest(),
      password: raw.password,
      mustChangeCredentialsOnFirstLogin: false,
      pin: null,
      grantGroupIds: raw.grantGroupIds,
      roleIds: raw.roleIds,
    };
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }

  private loadActiveServices(): void {
    this.servicesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeServices.set(result.items));
  }

  private loadActiveEngagementTypes(): void {
    this.engagementTypesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeEngagementTypes.set(result.items));
  }

  private loadActiveGrantGroups(): void {
    this.grantGroupsService.getAll().subscribe((result) => this.activeGrantGroups.set(result));
  }

  private loadActiveRoles(): void {
    this.rolesService.getAll().subscribe((result) => this.activeRoles.set(result));
  }

  private loadEmployee(id: string): void {
    this.loading.set(true);
    this.employeesService
      .getById(id)
      .subscribe({
        next: (employee) => this.applyEmployee(employee),
        error: () => {
          this.loading.set(false);
          this.navigateBack();
        },
      });
  }

  private applyEmployee(employee: EmployeeDto): void {
    this.loadedEmployeeLocations.set(employee.companies);
    this.loadedEmployeeServices.set(employee.services);
    this.loadedEmployeeEngagementType.set(
      employee.engagementTypeName ? { id: employee.engagementTypeId, name: employee.engagementTypeName } : null,
    );
    this.loadedUserId.set(employee.userId);

    const primary = employee.companies.find((company) => company.isPrimary);

    this.form.reset(
      {
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.phone ?? '',
        email: employee.email ?? '',
        dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth) : null,
        address: employee.address ?? '',
        oib: employee.oib ?? '',
        note: employee.note ?? '',
        compensationNote: employee.compensationNote ?? '',
        colorHex: employee.colorHex ? employee.colorHex.replace('#', '') : '',
        sortOrder: employee.sortOrder,
        employmentStartDate: new Date(employee.employmentStartDate),
        employmentEndDate: employee.employmentEndDate ? new Date(employee.employmentEndDate) : null,
        engagementTypeId: employee.engagementTypeId,
        locationIds: employee.companies.map((company) => company.companyId),
        primaryLocationId: primary?.companyId ?? null,
        serviceIds: employee.services.map((service) => service.serviceId),
        password: '',
        grantGroupIds: [],
        roleIds: [],
      },
      { emitEvent: false },
    );

    forkJoin([this.grantGroupsService.getAssignments(employee.userId), this.rolesService.getAssignments(employee.userId)])
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(([grantGroupIds, roleIds]) => {
        this.form.patchValue({ grantGroupIds, roleIds }, { emitEvent: false });
      });
  }

  private navigateBack(): void {
    this.router.navigate(['/admin/employees'], { queryParams: { tab: 'employees' } });
  }
}

/** Array-level: at least one GrantGroup must be selected - skipped entirely
 * for the Owner editing their own record (see isSelfOwnerEdit). */
function requiredGrantGroupsValidator(control: AbstractControl): ValidationErrors | null {
  const ids = (control.value as string[]) ?? [];
  return ids.length > 0 ? null : { required: true };
}
