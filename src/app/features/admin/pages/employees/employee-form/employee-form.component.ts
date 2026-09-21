import { Location } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Observable, finalize, forkJoin, of } from 'rxjs';
import {
  EmployeeDto,
  EmployeeCompany,
  EmployeeServiceLink,
  EmployeeUpsertRequest,
  EmployeeWithLoginRequest,
} from '../../../../../core/models/employee.model';
import { EngagementTypeDto } from '../../../../../core/models/engagement-type.model';
import { CompanyDto } from '../../../../../core/models/company.model';
import { GrantGroupDto, RoleDto } from '../../../../../core/models/permissions.model';
import { roleTranslationKey, UserRole, USER_ROLES } from '../../../../../core/models/role';
import { ServiceDto } from '../../../../../core/models/service.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { EngagementTypesService } from '../../../../../core/services/engagement-types.service';
import { GrantGroupsService } from '../../../../../core/services/grant-groups.service';
import { CompaniesService } from '../../../../../core/services/companies.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PermissionRolesService } from '../../../../../core/services/permission-roles.service';
import { ServicesService } from '../../../../../core/services/services.service';
import { toStartOfDayIso } from '../../../../../core/utils/date.util';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { WorkingHoursTemplateEditorComponent } from '../../../../../shared/components/working-hours-template-editor/working-hours-template-editor.component';
import { EmployeeHistoryTabComponent } from './employee-history-tab.component';
import { EmployeeLeaveFundTabComponent } from './employee-leave-fund-tab.component';

/** Route param sentinel for create mode - see admin.routes.ts ('employees/:id'
 * instead of a separate 'new' route), same convention as Paketi. */
const NEW_ID = 'new';

/** pageSize max is 200 - fetches the full active set in one page for the
 * company/service/engagement-type pickers. */
const LOOKUP_PAGE_SIZE = 200;
const EMPLOYEE_COLORS = [
  { name: 'Teal', value: '0D5C63' },
  { name: 'Svijetli teal', value: '128089' },
  { name: 'Burgundy', value: '8E3A4A' },
  { name: 'Dusty rose', value: '7A5D61' },
  { name: 'Slate', value: '545863' },
  { name: 'Mint', value: 'A8DCBE' },
];

export interface EmployeeOption {
  id: string;
  name: string;
}

/** Array-level: at least one company must be selected. */
function requiredCompaniesValidator(control: AbstractControl): ValidationErrors | null {
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

/** Group-level: the primary company must be one of the selected companies -
 * the backend enforces this too (VALIDATION_ERROR) but the form blocks it
 * first. */
function primaryCompanyValidator(group: AbstractControl): ValidationErrors | null {
  const companyIds = (group.get('companyIds')?.value as string[]) ?? [];
  const primaryCompanyId = group.get('primaryCompanyId')?.value as string | null;
  return primaryCompanyId && companyIds.includes(primaryCompanyId) ? null : { primaryNotSelected: true };
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
    DatePicker,
    Password,
    Select,
    Button,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    WorkingHoursTemplateEditorComponent,
    EmployeeLeaveFundTabComponent,
    EmployeeHistoryTabComponent,
  ],
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss',
})
export class EmployeeFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeesService = inject(EmployeesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly servicesService = inject(ServicesService);
  private readonly engagementTypesService = inject(EngagementTypesService);
  private readonly grantGroupsService = inject(GrantGroupsService);
  private readonly rolesService = inject(PermissionRolesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly validationAttempted = signal(false);

  /** True from the moment "Podaci" creates the employee (id: null -> id) for
   * the rest of this component's lifetime - distinguishes the "still walking
   * through the new-employee wizard" case from a plain re-open of an
   * already-existing employee via "uredi" (which starts in edit mode from
   * construction and never sets this), so the wizard's forced tab-advance and
   * "Spremi i nastavi/završi" labels apply only to the former. Leaving the
   * page mid-wizard (id already created) and reopening later is just a normal
   * edit from then on - see EmployeeFormComponent's own doc. */
  readonly justCreatedInWizard = signal(false);

  readonly activeTab = signal<'data' | 'workingHours' | 'leaveFund' | 'history'>('data');

  /** "Radno vrijeme" tab is shown (as a locked tab, see the template) as soon
   * as someone has a reason to see it at all - roster.templates is a grant of
   * its own, independent of employees.manage (see
   * WorkingHoursTemplateEditorComponent's own doc). It stays disabled until
   * editingId() exists, since the template endpoint is keyed by employeeId. */
  readonly canViewWorkingHours = computed(() => this.currentEmployeeService.can('roster.templates.view'));

  /** "Godišnji odmor" tab (frontend #18) - same shown-but-locked-until-id
   * rationale as canViewWorkingHours (both leave-settings and leave-funds
   * endpoints are keyed by employeeId), gated on any grant that gets you into
   * the tab at all; EmployeeLeaveFundTabComponent itself further splits
   * settings vs. funds visibility (see its own doc). */
  readonly canViewLeaveFund = computed(() =>
    this.currentEmployeeService.hasAnyGrant([
      'roster.leave-fund.settings.view',
      'roster.leave-fund.settings.manage',
      'roster.leave-fund.view.own',
      'roster.leave-fund.view.all',
    ]),
  );

  /** "Povijest" tab - GET /api/appointments/by-employee/{id} is gated by
   * Grants.AppointmentsView on the backend, same grant set as the Raspored nav
   * item itself (see nav-items.ts, PAGE_POLICIES.schedule) - anyone who can
   * see the schedule at all can see one employee's own completed history.
   * Reuses canPage('schedule') rather than its own grant array, so it can
   * never drift from the actual Raspored page policy. Shown-but-locked-until-id,
   * same rationale as canViewWorkingHours/canViewLeaveFund. */
  readonly canViewHistory = computed(() => this.currentEmployeeService.canPage('schedule'));

  /** "Podaci" tab's submit button - "Spremi i nastavi" only while creating
   * (no id yet); once the employee exists, Save behaves plainly whether
   * that's mid-wizard or a genuine later edit (see justCreatedInWizard's
   * doc - the wizard's forced continuation only ever applies to the *next*
   * tab, triggered from that tab's own save, not from re-saving "Podaci"). */
  readonly dataSaveLabelKey = computed(() => (this.editingId() ? 'COMMON.SAVE' : 'EMPLOYEES.SAVE_AND_CONTINUE'));

  readonly workingHoursSaveLabelKey = computed(() =>
    this.justCreatedInWizard() ? 'EMPLOYEES.SAVE_AND_CONTINUE' : 'COMMON.SAVE',
  );

  readonly leaveFundSaveLabelKey = computed(() =>
    this.justCreatedInWizard() ? 'EMPLOYEES.SAVE_AND_FINISH' : 'COMMON.SAVE',
  );

  readonly activeCompanies = signal<CompanyDto[]>([]);
  readonly activeServices = signal<ServiceDto[]>([]);
  readonly activeEngagementTypes = signal<EngagementTypeDto[]>([]);
  readonly activeGrantGroups = signal<GrantGroupDto[]>([]);
  readonly activeRoles = signal<RoleDto[]>([]);
  readonly colorOptions = EMPLOYEE_COLORS;

  /** Companies/services/engagement type linked to the employee being edited
   * that have since been deactivated - kept visible in their picker (with a
   * badge) instead of silently dropped. Derived, not set directly, so it stays
   * correct regardless of whether the employee or the active-list fetch
   * finishes loading first (see PackageFormComponent for the same pattern). */
  private readonly loadedEmployeeCompanies = signal<EmployeeCompany[]>([]);
  private readonly loadedEmployeeServices = signal<EmployeeServiceLink[]>([]);
  private readonly loadedEmployeeEngagementType = signal<EmployeeOption | null>(null);

  /** The User.Id behind the employee being edited - GrantGroup/Role assignment
   * endpoints key by userId, NOT the employee id this whole form otherwise
   * navigates by (see EmployeeDto.userId). */
  private readonly loadedUserId = signal<string | null>(null);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly companyOptions = computed<EmployeeOption[]>(() => this.mergeOptions(
    this.activeCompanies().map((company) => ({ id: company.id, name: company.name })),
    this.loadedEmployeeCompanies().map((link) => ({ id: link.companyId, name: link.companyName })),
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

  /** PATCH /api/employees/{id}/role is RequireGrant(employees.role.manage),
   * NOT Owner-only (unlike GrantGroup/business-Role assignment above) - a
   * non-Owner Admin holding this grant may change an employee's coarse
   * UserRole even though GrantGroup/Role definition stays Owner-only. Uses
   * the existing ACTION_POLICY (see action-policies.ts) rather than
   * isOwner(), so this section's visibility can never drift from what the
   * backend endpoint actually allows (Part P of the FAZA 1 role editor). */
  readonly canManageEmployeeRole = computed(() => this.currentEmployeeService.can('employees.role.manage'));

  readonly userRoleSelectOptions = computed(() => {
    this.translationsReady();
    return USER_ROLES.map((role) => ({ value: role, label: this.translate.instant(roleTranslationKey(role)) }));
  });

  /** The UserRole loaded from the server, to diff against on save - only
   * calls updateRole() when the Owner/Admin actually changed it. */
  private readonly loadedUserRole = signal<UserRole | null>(null);

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
      companyIds: this.fb.nonNullable.control<string[]>([], requiredCompaniesValidator),
      primaryCompanyId: this.fb.control<string | null>(null),
      serviceIds: this.fb.nonNullable.control<string[]>([]),
      password: [''],
      grantGroupIds: this.fb.nonNullable.control<string[]>([]),
      roleIds: this.fb.nonNullable.control<string[]>([]),
      userRole: this.fb.control<UserRole | null>(null),
    },
    { validators: [primaryCompanyValidator, employmentDatesValidator] },
  );

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam && idParam !== NEW_ID ? idParam : null;
    this.editingId.set(id);

    // "Povijest klijenta"-style shortcut from the employee list's history icon
    // (?tab=history) - lands straight on the tab instead of "Podaci", see
    // EmployeeListComponent.openHistory.
    if (this.route.snapshot.queryParamMap.get('tab') === 'history') {
      this.activeTab.set('history');
    }

    this.loadActiveCompanies();
    this.loadActiveServices();
    this.loadActiveEngagementTypes();
    // GrantGroupsController/RolesController are BOTH [RequireOwner] end to end
    // (list included, not just the assignment endpoints) - a non-Owner viewer
    // (even one holding employees.manage) gets a 403 on GetAll, so don't even
    // attempt these fetches for them (see the matching skip in applyEmployee()
    // and onSave()'s update branch).
    if (this.currentEmployeeService.isOwner()) {
      this.loadActiveGrantGroups();
      this.loadActiveRoles();
    }

    if (id) {
      this.loadEmployee(id);
    } else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
      this.form.controls.password.updateValueAndValidity();
    }

    // GrantGroups are required for every employee except the Owner editing
    // their own record (see isSelfOwnerEdit) - reactive rather than set once,
    // since isSelfOwnerEdit can only be known once CurrentEmployeeService's
    // async /me load resolves. A non-Owner viewer never sees/populates this
    // field at all (see the isOwner() guard above), so it must not be
    // required for them either - otherwise the form is permanently invalid
    // and Save silently does nothing.
    effect(() => {
      const control = this.form.controls.grantGroupIds;
      if (this.isSelfOwnerEdit() || !this.currentEmployeeService.isOwner()) {
        control.clearValidators();
      } else {
        control.setValidators(requiredGrantGroupsValidator);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });

    // If the user deselects the current primary company from the multiselect,
    // don't leave a now-invalid primaryCompanyId silently selected.
    this.form.controls.companyIds.valueChanges.subscribe((ids) => {
      const primary = this.form.controls.primaryCompanyId.value;
      if (primary && !ids.includes(primary)) {
        this.form.controls.primaryCompanyId.setValue(null);
      }
    });
  }

  /** Options for the primary-company select: only companies currently picked
   * in the companyIds multiselect. */
  primaryCompanyOptions(): EmployeeOption[] {
    const selected = new Set(this.form.controls.companyIds.value);
    return this.companyOptions().filter((option) => selected.has(option.id));
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.validationAttempted.set(true);
      return;
    }

    this.validationAttempted.set(false);

    const id = this.editingId();
    this.saving.set(true);

    if (id) {
      const userId = this.loadedUserId();
      this.employeesService
        .update(id, this.toUpsertRequest())
        .subscribe({
          next: () => {
            const raw = this.form.getRawValue();
            // GrantGroup/business-Role endpoints are [RequireOwner] server-side
            // (see the matching skip in the constructor/applyEmployee()) -
            // calling them for a non-Owner viewer would 403 and swallow an
            // otherwise-successful employee update in the generic
            // `error: () => {}` below, leaving Save looking like it silently
            // did nothing. UserRole (Podaci > Uloga) is a SEPARATE endpoint
            // gated by employees.role.manage, not Owner-only - see
            // canManageEmployeeRole's own doc - only called when it actually
            // changed, to avoid a pointless LastActiveAdmin re-check on every save.
            const calls: Observable<unknown>[] = [];
            if (userId && this.currentEmployeeService.isOwner()) {
              if (!this.isSelfOwnerEdit()) {
                calls.push(this.grantGroupsService.setAssignments(userId, { grantGroupIds: raw.grantGroupIds }));
              }
              calls.push(this.rolesService.setAssignments(userId, { roleIds: raw.roleIds }));
            }
            if (this.canManageEmployeeRole() && raw.userRole && raw.userRole !== this.loadedUserRole()) {
              calls.push(this.employeesService.updateRole(id, raw.userRole));
            }
            const assignments$: Observable<unknown> = calls.length > 0 ? forkJoin(calls) : of(null);
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
          next: (response) => {
            // GrantGroup/Role assignment on a later "Podaci" re-save needs
            // this (see the `if (id)` branch above) - only known from here on.
            this.loadedUserId.set(response.userId);
            this.editingId.set(response.employeeId);
            this.justCreatedInWizard.set(true);
            // The password/login section only makes sense pre-creation (see
            // the template's isEditMode() gate) - the control still holding a
            // valid value would keep the form "valid" either way, but clearing
            // its validators here keeps it from having an opinion on a field
            // it can no longer even show.
            this.form.controls.password.clearValidators();
            this.form.controls.password.updateValueAndValidity();
            this.location.replaceState(`/app/employees/${response.employeeId}`);
            this.notifications.showSuccess(this.translate.instant('EMPLOYEES.CREATED'));
            this.goToNextWizardStep('data');
          },
          error: () => {},
        });
    }
  }

  onCancel(): void {
    this.navigateBack();
  }

  selectEngagementType(id: string): void { this.form.controls.engagementTypeId.setValue(id); }
  selectColor(value: string): void { this.form.controls.colorHex.setValue(value); }
  selectPrimaryCompany(id: string): void { this.form.controls.primaryCompanyId.setValue(id); }
  toggleCompany(id: string): void { this.toggleIds('companyIds', id); }
  toggleService(id: string): void { this.toggleIds('serviceIds', id); }
  toggleGrantGroup(id: string): void { this.toggleIds('grantGroupIds', id); }
  toggleRole(id: string): void { this.toggleIds('roleIds', id); }
  isSelected(ids: string[], id: string): boolean { return ids.includes(id); }

  onWorkingHoursSaved(): void {
    if (this.justCreatedInWizard()) {
      this.goToNextWizardStep('workingHours');
    }
  }

  onLeaveFundSaved(): void {
    if (this.justCreatedInWizard()) {
      this.goToNextWizardStep('leaveFund');
    }
  }

  /** Advances to the next unlocked wizard tab after `current`, or - once
   * there's nothing left to walk through (either every later tab is hidden by
   * grants, or `current` was already the last one) - finishes the wizard the
   * same way a plain edit-mode save always has: back to the list. Only called
   * while justCreatedInWizard() is true; a normal edit never forces tab
   * navigation on save (see each *SaveLabelKey's doc). */
  private goToNextWizardStep(current: 'data' | 'workingHours' | 'leaveFund'): void {
    if (current === 'data' && this.canViewWorkingHours()) {
      this.activeTab.set('workingHours');
    } else if (current !== 'leaveFund' && this.canViewLeaveFund()) {
      this.activeTab.set('leaveFund');
    } else {
      this.navigateBack();
    }
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

  private toggleIds(controlName: 'companyIds' | 'serviceIds' | 'grantGroupIds' | 'roleIds', id: string): void {
    const control = this.form.controls[controlName];
    const ids = control.value;
    control.setValue(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
    if (controlName === 'companyIds' && !control.value.includes(this.form.controls.primaryCompanyId.value ?? '')) {
      this.form.controls.primaryCompanyId.setValue(null);
    }
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
      companyIds: raw.companyIds,
      primaryCompanyId: raw.primaryCompanyId as string,
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

  private loadActiveCompanies(): void {
    this.companiesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeCompanies.set(result.items));
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
    this.loadedEmployeeCompanies.set(employee.companies);
    this.loadedEmployeeServices.set(employee.services);
    this.loadedEmployeeEngagementType.set(
      employee.engagementTypeName ? { id: employee.engagementTypeId, name: employee.engagementTypeName } : null,
    );
    this.loadedUserId.set(employee.userId);
    this.loadedUserRole.set(employee.role);

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
        companyIds: employee.companies.map((company) => company.companyId),
        primaryCompanyId: primary?.companyId ?? null,
        serviceIds: employee.services.map((service) => service.serviceId),
        password: '',
        grantGroupIds: [],
        roleIds: [],
        userRole: employee.role,
      },
      { emitEvent: false },
    );

    // Same [RequireOwner] reasoning as the constructor's loadActiveGrantGroups/
    // loadActiveRoles skip - a non-Owner viewer can't read these either, so
    // don't attempt the fetch (would 403 and leave `loading` stuck without
    // the finalize below).
    if (this.currentEmployeeService.isOwner()) {
      forkJoin([this.grantGroupsService.getAssignments(employee.userId), this.rolesService.getAssignments(employee.userId)])
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe(([grantGroupIds, roleIds]) => {
          this.form.patchValue({ grantGroupIds, roleIds }, { emitEvent: false });
        });
    } else {
      this.loading.set(false);
    }
  }

  private navigateBack(): void {
    this.router.navigate(['/app/employees'], { queryParams: { tab: 'employees' } });
  }
}

/** Array-level: at least one GrantGroup must be selected - skipped entirely
 * for the Owner editing their own record (see isSelfOwnerEdit). */
function requiredGrantGroupsValidator(control: AbstractControl): ValidationErrors | null {
  const ids = (control.value as string[]) ?? [];
  return ids.length > 0 ? null : { required: true };
}
