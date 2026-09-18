import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { finalize } from 'rxjs';
import { CompanyDto, CompanyUpsertRequest } from '../../../../../core/models/company.model';
import { CompaniesService } from '../../../../../core/services/companies.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { WorkingHoursTemplateEditorComponent } from '../../../../../shared/components/working-hours-template-editor/working-hours-template-editor.component';
import { CompanyHolidaysTabComponent } from './company-holidays-tab.component';
import { RoomsTabComponent } from './rooms-tab.component';

const DEFAULT_COLOR_NO_HASH = '0D5C63';
const COMPANY_COLORS = ['0D5C63', '128089', '8E3A4A', '7A5D61', '545863', 'A8DCBE'];
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
  selector: 'app-company-detail',
  imports: [
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
  templateUrl: './company-detail.component.html',
  styleUrl: './company-detail.component.scss',
})
export class CompanyDetailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly companiesService = inject(CompaniesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly companyId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly company = signal<CompanyDto | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly activeTab = signal<'data' | 'workingHours' | 'holidays' | 'rooms'>('data');
  readonly countryOptions = COUNTRY_OPTIONS;
  readonly colorOptions = COMPANY_COLORS;

  readonly canViewWorkingHours = computed(() =>
    this.currentEmployeeService.hasAnyGrant(['roster.templates.view', 'roster.templates.manage']),
  );
  readonly canViewHolidays = computed(() =>
    this.currentEmployeeService.hasAnyGrant(['roster.templates.view', 'roster.templates.manage']),
  );
  readonly canViewRooms = computed(() =>
    this.currentEmployeeService.hasAnyGrant(['catalog.rooms.view', 'catalog.rooms.manage']),
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
    this.load();
  }

  goBack(): void {
    window.history.back();
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

  onSave(): void {
    if (this.form.invalid || !this.companyId) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: CompanyUpsertRequest = {
      name: raw.name.trim(),
      address: raw.address.trim() || null,
      phone: raw.phone.trim() || null,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      country: raw.country,
      note: raw.note.trim() || null,
      sortOrder: raw.sortOrder,
    };

    this.saving.set(true);
    this.companiesService
      .update(this.companyId, request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (company) => {
          this.company.set(company);
          this.resetForm(company);
          this.notifications.showSuccess(this.translate.instant('CATALOG.COMPANIES.UPDATED'));
        },
        error: () => {},
      });
  }

  private load(): void {
    if (!this.companyId) {
      return;
    }

    this.loading.set(true);
    this.companiesService
      .getById(this.companyId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (company) => {
          this.company.set(company);
          this.resetForm(company);
        },
        error: () => {},
      });
  }

  private resetForm(company: CompanyDto): void {
    this.form.reset({
      name: company.name,
      address: company.address ?? '',
      phone: company.phone ?? '',
      colorHex: company.colorHex ? company.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      country: company.country,
      note: company.note ?? '',
      sortOrder: company.sortOrder,
    });
  }
}
