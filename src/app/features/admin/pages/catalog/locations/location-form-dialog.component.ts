import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { LocationDto, LocationUpsertRequest } from '../../../../../core/models/location.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { WorkingHoursTemplateEditorComponent } from '../../../../../shared/components/working-hours-template-editor/working-hours-template-editor.component';
import { CompanyHolidaysTabComponent } from './company-holidays-tab.component';

/** Olive-gold from the dune palette - a sensible default when creating a new
 * location, before the user picks their own color. */
const DEFAULT_COLOR_NO_HASH = '8F7A45';

/** ISO 3166-1 alpha-2 - a short, non-exhaustive list is enough here, not a
 * full country picker. A location whose actual country is missing from this
 * list just falls back to manual holiday entry - see
 * CompanyHolidaysTabComponent's HOLIDAY_CATALOG_NOT_DEFINED_FOR_COUNTRY hint. */
const COUNTRY_OPTIONS = [
  { code: 'HR', name: 'Hrvatska' },
  { code: 'SI', name: 'Slovenija' },
  { code: 'BA', name: 'Bosna i Hercegovina' },
  { code: 'RS', name: 'Srbija' },
  { code: 'AT', name: 'Austrija' },
  { code: 'DE', name: 'Njemačka' },
  { code: 'IT', name: 'Italija' },
];

@Component({
  selector: 'app-location-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    InputText,
    Textarea,
    InputNumber,
    ColorPicker,
    Select,
    Button,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    WorkingHoursTemplateEditorComponent,
    CompanyHolidaysTabComponent,
  ],
  templateUrl: './location-form-dialog.component.html',
})
export class LocationFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly locationsService = inject(LocationsService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly location = input<LocationDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.location() !== null);
  readonly activeTab = signal<'data' | 'workingHours' | 'holidays'>('data');

  readonly countryOptions = COUNTRY_OPTIONS;

  /** Id of a location created during this dialog's current create-mode
   * session - lets the "Radno vrijeme" tab unlock immediately after "Podaci"
   * creates the location, same wizard mechanism as
   * EmployeeFormComponent.editingId (see its own doc): a brand-new location
   * has no id for the working-hours endpoint until this fires. */
  readonly createdLocationId = signal<string | null>(null);

  readonly currentLocationId = computed(() => this.location()?.id ?? this.createdLocationId());

  /** True once "Podaci" has created the location within this open dialog
   * session - drives the forced tab-advance to "Radno vrijeme" and the
   * "Spremi i nastavi" button label, same as
   * EmployeeFormComponent.justCreatedInWizard. A plain edit of an
   * already-existing location never sets this - both tabs are simply usable
   * independently from the moment the dialog opens. */
  readonly justCreatedInWizard = signal(false);

  /** roster.templates is its own grant, independent of catalog.companies.manage
   * (see WorkingHoursTemplateEditorComponent's own doc) - hide the tab
   * entirely for a user with neither, same as LocationsComponent's own
   * canViewWorkingHours (that one still gates the now-removed standalone
   * dialog's entry point in the row actions). */
  readonly canViewWorkingHours = computed(() =>
    this.currentEmployeeService.hasAnyGrant(['roster.templates.view', 'roster.templates.manage']),
  );

  /** Same grant as "Radno vrijeme" (roster.templates.view/.manage) - Praznici
   * lives under the same Roster module on the backend. */
  readonly canViewHolidays = computed(() =>
    this.currentEmployeeService.hasAnyGrant(['roster.templates.view', 'roster.templates.manage']),
  );

  readonly dataSaveLabelKey = computed(() =>
    this.currentLocationId() ? 'COMMON.SAVE' : 'CATALOG.LOCATIONS.SAVE_AND_CONTINUE',
  );

  readonly workingHoursSaveLabelKey = computed(() =>
    this.justCreatedInWizard() ? 'CATALOG.LOCATIONS.SAVE_AND_FINISH' : 'COMMON.SAVE',
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    address: ['', Validators.maxLength(500)],
    phone: ['', Validators.maxLength(50)],
    colorHex: [DEFAULT_COLOR_NO_HASH],
    country: this.fb.nonNullable.control('HR', Validators.required),
    note: [''],
    sortOrder: [0],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.activeTab.set('data');
        this.createdLocationId.set(null);
        this.justCreatedInWizard.set(false);
        this.resetForm(this.location());
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: LocationUpsertRequest = {
      name: raw.name,
      address: raw.address || null,
      phone: raw.phone || null,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      country: raw.country,
      note: raw.note || null,
      sortOrder: raw.sortOrder,
    };

    const current = this.location();
    const request$ = current
      ? this.locationsService.update(current.id, request)
      : this.locationsService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (result) => {
        this.notifications.showSuccess(
          this.translate.instant(current ? 'CATALOG.LOCATIONS.UPDATED' : 'CATALOG.LOCATIONS.CREATED'),
        );
        if (current) {
          this.visible.set(false);
        } else if (this.canViewWorkingHours()) {
          // New location, "Radno vrijeme" tab available - stay open and walk
          // into it next, same wizard shape as EmployeeFormComponent (see
          // justCreatedInWizard's doc), instead of closing right away.
          this.createdLocationId.set(result.id);
          this.justCreatedInWizard.set(true);
          this.activeTab.set('workingHours');
        } else {
          this.visible.set(false);
        }
        this.saved.emit();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  /** Only closes the dialog when working hours were saved as the last step of
   * the new-location wizard - editing an existing location's hours is just a
   * self-contained tab save, no reason to close anything (see
   * justCreatedInWizard's doc). */
  onWorkingHoursSaved(): void {
    if (this.justCreatedInWizard()) {
      this.visible.set(false);
    }
  }

  private resetForm(location: LocationDto | null): void {
    this.form.reset({
      name: location?.name ?? '',
      address: location?.address ?? '',
      phone: location?.phone ?? '',
      colorHex: location?.colorHex ? location.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      country: location?.country ?? 'HR',
      note: location?.note ?? '',
      sortOrder: location?.sortOrder ?? 0,
    });
  }
}
