import { Component, inject, model, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CompleteOwnEmployeeRequest } from '../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { EmployeesService } from '../../../core/services/employees.service';
import { EngagementTypesService } from '../../../core/services/engagement-types.service';
import { LocationsService } from '../../../core/services/locations.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ServicesService } from '../../../core/services/services.service';
import { toStartOfDayIso } from '../../../core/utils/date.util';

const LOOKUP_PAGE_SIZE = 200;

export interface CompleteProfileOption {
  id: string;
  name: string;
}

/** Array-level: at least one location must be selected. Same rule as
 * EmployeeFormComponent's requiredLocationsValidator - duplicated here rather
 * than shared since this form's field set is deliberately smaller. */
function requiredLocationsValidator(control: AbstractControl): ValidationErrors | null {
  const ids = (control.value as string[]) ?? [];
  return ids.length > 0 ? null : { required: true };
}

/** Group-level: the primary location must be one of the selected locations. */
function primaryLocationValidator(group: AbstractControl): ValidationErrors | null {
  const locationIds = (group.get('locationIds')?.value as string[]) ?? [];
  const primaryLocationId = group.get('primaryLocationId')?.value as string | null;
  return primaryLocationId && locationIds.includes(primaryLocationId) ? null : { primaryNotSelected: true };
}

/**
 * "Dovrši svoj profil" modal (frontend #15) - lets an Owner who has a User +
 * Organization but no Employee record yet (GET /api/employees/me 404s, see
 * CurrentEmployeeService's doc) create their own Employee via
 * POST /api/employees (not the with-login endpoint - there's no new login
 * here, the Owner already has one). Deliberately a smaller field set than
 * EmployeeFormComponent (admin's full create/edit form): no login section, no
 * GrantGroups/Roles (the Owner bypasses the grant system entirely), no
 * dateOfBirth/address/oib/note/compensationNote/employmentEndDate - those
 * aren't needed to unblock the trainer views this profile exists to enable,
 * and can be filled in later via the normal Zaposlenici edit form.
 */
@Component({
  selector: 'app-complete-employee-profile-dialog',
  imports: [Dialog, ReactiveFormsModule, InputText, Select, MultiSelect, DatePicker, ColorPicker, InputNumber, Button, TranslatePipe],
  templateUrl: './complete-employee-profile-dialog.component.html',
})
export class CompleteEmployeeProfileDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly locationsService = inject(LocationsService);
  private readonly servicesService = inject(ServicesService);
  private readonly engagementTypesService = inject(EngagementTypesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly completed = output<void>();

  readonly saving = signal(false);
  readonly dialogShown = signal(false);

  readonly locationOptions = signal<CompleteProfileOption[]>([]);
  readonly serviceOptions = signal<CompleteProfileOption[]>([]);
  readonly engagementTypeOptions = signal<CompleteProfileOption[]>([]);

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(255)]],
      lastName: ['', [Validators.required, Validators.maxLength(255)]],
      phone: [''],
      email: [''],
      employmentStartDate: this.fb.control<Date | null>(new Date(), Validators.required),
      engagementTypeId: ['', Validators.required],
      locationIds: this.fb.nonNullable.control<string[]>([], requiredLocationsValidator),
      primaryLocationId: this.fb.control<string | null>(null),
      serviceIds: this.fb.nonNullable.control<string[]>([]),
      colorHex: [''],
      sortOrder: [0],
    },
    { validators: [primaryLocationValidator] },
  );

  constructor() {
    this.form.controls.locationIds.valueChanges.subscribe((ids) => {
      const primary = this.form.controls.primaryLocationId.value;
      if (primary && !ids.includes(primary)) {
        this.form.controls.primaryLocationId.setValue(null);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
    this.resetForm();
    this.loadActiveLocations();
    this.loadActiveServices();
    this.loadActiveEngagementTypes();
  }

  onDialogHide(): void {
    this.dialogShown.set(false);
  }

  /** Options for the primary-location select: only locations currently picked
   * in the locationIds multiselect (same pattern as EmployeeFormComponent). */
  primaryLocationOptions(): CompleteProfileOption[] {
    const selected = new Set(this.form.controls.locationIds.value);
    return this.locationOptions().filter((option) => selected.has(option.id));
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const userId = this.authService.currentUser()?.userId;
    if (!userId) {
      return;
    }

    const raw = this.form.getRawValue();
    const request: CompleteOwnEmployeeRequest = {
      userId,
      firstName: raw.firstName,
      lastName: raw.lastName,
      phone: raw.phone || null,
      email: raw.email || null,
      dateOfBirth: null,
      address: null,
      oib: null,
      note: null,
      compensationNote: null,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      sortOrder: raw.sortOrder,
      employmentStartDate: toStartOfDayIso(raw.employmentStartDate as Date),
      employmentEndDate: null,
      engagementTypeId: raw.engagementTypeId,
      companyIds: raw.locationIds,
      primaryCompanyId: raw.primaryLocationId as string,
      serviceIds: raw.serviceIds,
    };

    this.saving.set(true);
    this.employeesService
      .completeOwnProfile(request)
      .subscribe({
        next: () => {
          this.currentEmployeeService
            .load()
            .pipe(finalize(() => this.saving.set(false)))
            .subscribe(() => {
              this.notifications.showSuccess(this.translate.instant('COMPLETE_PROFILE.SAVED'));
              this.visible.set(false);
              this.completed.emit();
            });
        },
        error: () => this.saving.set(false),
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  private resetForm(): void {
    this.form.reset({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      employmentStartDate: new Date(),
      engagementTypeId: '',
      locationIds: [],
      primaryLocationId: null,
      serviceIds: [],
      colorHex: '',
      sortOrder: 0,
    });
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) =>
        this.locationOptions.set(result.items.map((location) => ({ id: location.id, name: location.name }))),
      );
  }

  private loadActiveServices(): void {
    this.servicesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) =>
        this.serviceOptions.set(result.items.map((service) => ({ id: service.id, name: service.name }))),
      );
  }

  private loadActiveEngagementTypes(): void {
    this.engagementTypesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) =>
        this.engagementTypeOptions.set(result.items.map((type) => ({ id: type.id, name: type.name }))),
      );
  }
}
