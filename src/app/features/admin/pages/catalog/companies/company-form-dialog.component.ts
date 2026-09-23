import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { finalize } from 'rxjs';
import { CompanyDto, CompanyUpsertRequest } from '../../../../../core/models/company.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { CompaniesService } from '../../../../../core/services/companies.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { WorkingHoursTemplateEditorComponent } from '../../../../../shared/components/working-hours-template-editor/working-hours-template-editor.component';
import { CompanyHolidaysTabComponent } from './company-holidays-tab.component';
import { RoomsTabComponent } from './rooms-tab.component';

const DEFAULT_COLOR_NO_HASH = '0D5C63';
const COMPANY_COLORS = ['0D5C63', '128089', '8E3A4A', '7A5D61', '545863', 'A8DCBE'];

/** ISO 3166-1 alpha-2 - a short, non-exhaustive list is enough here, not a
 * full country picker. A company whose actual country is missing from this
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
  selector: 'app-company-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    InputText,
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
    RoomsTabComponent,
  ],
  templateUrl: './company-form-dialog.component.html',
})
export class CompanyFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companiesService = inject(CompaniesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly company = input<CompanyDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.company() !== null);
  readonly activeTab = signal<'data' | 'workingHours' | 'holidays' | 'rooms'>('data');

  readonly countryOptions = COUNTRY_OPTIONS;
  readonly colorOptions = COMPANY_COLORS;

  /** Id of a company created during this dialog's current create-mode
   * session - lets the "Radno vrijeme" tab unlock immediately after "Podaci"
   * creates the company, same wizard mechanism as
   * EmployeeFormComponent.editingId (see its own doc): a brand-new company
   * has no id for the working-hours endpoint until this fires. */
  readonly createdCompanyId = signal<string | null>(null);

  readonly currentCompanyId = computed(() => this.company()?.id ?? this.createdCompanyId());

  /** True once "Podaci" has created the company within this open dialog
   * session - drives the forced tab-advance to "Radno vrijeme" and the
   * "Spremi i nastavi" button label, same as
   * EmployeeFormComponent.justCreatedInWizard. A plain edit of an
   * already-existing company never sets this - both tabs are simply usable
   * independently from the moment the dialog opens. */
  readonly justCreatedInWizard = signal(false);

  /** roster.templates is its own grant, independent of catalog.companies.manage
   * (see WorkingHoursTemplateEditorComponent's own doc) - hide the tab
   * entirely for a user with neither, same as CompaniesComponent's own
   * canViewWorkingHours (that one still gates the now-removed standalone
   * dialog's entry point in the row actions). */
  readonly canViewWorkingHours = computed(() => this.currentEmployeeService.can('roster.templates.view'));

  /** Same grant as "Radno vrijeme" (roster.templates.view/.manage) - Praznici
   * lives under the same Roster module on the backend. */
  readonly canViewHolidays = computed(() => this.currentEmployeeService.can('roster.templates.view'));

  /** catalog.rooms.view/.manage - its own grant, independent of the tabs above. */
  readonly canViewRooms = computed(() => this.currentEmployeeService.can('catalog.rooms.view'));

  readonly dataSaveLabelKey = computed(() =>
    this.currentCompanyId() ? 'COMMON.SAVE' : 'CATALOG.COMPANIES.SAVE_AND_CONTINUE',
  );

  readonly workingHoursSaveLabelKey = computed(() =>
    this.justCreatedInWizard() ? 'CATALOG.COMPANIES.SAVE_AND_FINISH' : 'COMMON.SAVE',
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

  /** Bumped on every open. A save that completes after the dialog was closed and
   * reopened belongs to the earlier open: it may refresh the parent, but must not
   * close or re-target the current one (e.g. turn a fresh "new" into the wizard
   * of the company the earlier save created). */
  private openGeneration = 0;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.openGeneration++;
        this.saving.set(false);
        this.activeTab.set('data');
        this.createdCompanyId.set(null);
        this.justCreatedInWizard.set(false);
        this.resetForm(this.company());
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: CompanyUpsertRequest = {
      name: raw.name,
      address: raw.address || null,
      phone: raw.phone || null,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      country: raw.country,
      note: raw.note || null,
      sortOrder: raw.sortOrder,
    };

    // Not company(): after the wizard creates a company, company() is still
    // null, and going back to "Podaci" and saving must update, not re-create.
    const existingId = this.currentCompanyId();
    const request$ = existingId
      ? this.companiesService.update(existingId, request)
      : this.companiesService.create(request);

    const generation = this.openGeneration;
    this.saving.set(true);
    request$.pipe(finalize(() => generation === this.openGeneration && this.saving.set(false))).subscribe({
      next: (result) => {
        this.notifications.showSuccess(
          this.translate.instant(existingId ? 'CATALOG.COMPANIES.UPDATED' : 'CATALOG.COMPANIES.CREATED'),
        );
        if (generation !== this.openGeneration) {
          this.saved.emit();
          return;
        }
        if (existingId) {
          this.visible.set(false);
        } else if (this.canViewWorkingHours()) {
          // New company, "Radno vrijeme" tab available - stay open and walk
          // into it next, same wizard shape as EmployeeFormComponent (see
          // justCreatedInWizard's doc), instead of closing right away.
          this.createdCompanyId.set(result.id);
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

  selectColor(color: string): void {
    this.form.controls.colorHex.setValue(color);
  }

  decrementSortOrder(): void {
    this.form.controls.sortOrder.setValue(this.form.controls.sortOrder.value - 1);
  }

  incrementSortOrder(): void {
    this.form.controls.sortOrder.setValue(this.form.controls.sortOrder.value + 1);
  }

  headerTitle(): string {
    return this.translate.instant(this.isEditMode() ? 'CATALOG.COMPANIES.EDIT_TITLE' : 'CATALOG.COMPANIES.NEW_TITLE');
  }

  headerSubtitle(): string {
    const name = this.form.controls.name.value.trim();
    const address = this.form.controls.address.value.trim();
    if (name && address) {
      return `${name} · ${address}`;
    }
    return this.translate.instant('CATALOG.COMPANIES.MODAL_SUBTITLE');
  }

  /** Only closes the dialog when working hours were saved as the last step of
   * the new-company wizard - editing an existing company's hours is just a
   * self-contained tab save, no reason to close anything (see
   * justCreatedInWizard's doc). */
  onWorkingHoursSaved(): void {
    if (this.justCreatedInWizard()) {
      this.visible.set(false);
    }
  }

  private resetForm(company: CompanyDto | null): void {
    this.form.reset({
      name: company?.name ?? '',
      address: company?.address ?? '',
      phone: company?.phone ?? '',
      colorHex: company?.colorHex ? company.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      country: company?.country ?? 'HR',
      note: company?.note ?? '',
      sortOrder: company?.sortOrder ?? 0,
    });
  }
}
