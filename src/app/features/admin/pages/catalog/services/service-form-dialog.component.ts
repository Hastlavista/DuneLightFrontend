import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { CompanyDto } from '../../../../../core/models/company.model';
import {
  EXECUTION_MODES,
  ServiceDto,
  ServiceExecutionMode,
  ServiceUpsertRequest,
  executionModeTranslationKey,
} from '../../../../../core/models/service.model';
import { CompaniesService } from '../../../../../core/services/companies.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ServicesService } from '../../../../../core/services/services.service';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';

const DEFAULT_DURATION_MINUTES = 30;
const COMPANY_LOOKUP_PAGE_SIZE = 200;

interface CompanyChoiceOption {
  id: string;
  name: string;
  inactive: boolean;
}

/** Olive-gold from the dune palette - a sensible default when creating a new
 * service, before the user picks their own color. */
const DEFAULT_COLOR_NO_HASH = '8F7A45';

interface ExecutionModeOption {
  label: string;
  value: ServiceExecutionMode;
}

interface ServiceColorOption {
  label: string;
  value: string;
}

const SERVICE_COLORS: ServiceColorOption[] = [
  { label: 'Teal', value: '0F6871' },
  { label: 'Svijetli teal', value: '168A91' },
  { label: 'Burgundy', value: '96384B' },
  { label: 'Dusty rose', value: '826365' },
  { label: 'Slate', value: '555B68' },
  { label: 'Mint', value: 'A9DDC3' },
];

@Component({
  selector: 'app-service-form-dialog',
  imports: [
    Dialog,
    ReactiveFormsModule,
    InputText,
    InputNumber,
    ColorPicker,
    Select,
    Button,
    TranslatePipe,
  ],
  templateUrl: './service-form-dialog.component.html',
  styleUrl: './service-form-dialog.component.scss',
})
export class ServiceFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly servicesService = inject(ServicesService);
  private readonly companiesService = inject(CompaniesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly service = input<ServiceDto | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly isEditMode = computed(() => this.service() !== null);
  readonly colorOptions = SERVICE_COLORS;
  readonly executionModeTranslationKey = executionModeTranslationKey;

  private readonly translationsReady = translationReadySignal(this.translate);

  /** All active Companies (lookup pool) - loaded once, not per-open. */
  private readonly activeCompanies = signal<CompanyDto[]>([]);
  /** Companies actually assigned to the Service being edited right now (GET
   * .../companies) - incl. a possibly-inactive/grandfathered one, see
   * ServicesService.getAssignedCompanies's doc. Empty (not loading) for a new
   * Service, which starts with zero assignments. */
  private readonly assignedCompanies = signal<CompanyDto[]>([]);
  readonly companiesLoading = signal(false);

  /** Active Companies plus any currently-assigned-but-now-inactive one (kept
   * visible with a badge instead of silently dropped from the picker) - same
   * grandfathering pattern as EmployeeFormComponent.companyOptions. */
  readonly companyOptions = computed<CompanyChoiceOption[]>(() => {
    const active = this.activeCompanies();
    const activeIds = new Set(active.map((company) => company.id));
    const grandfathered = this.assignedCompanies().filter((company) => !activeIds.has(company.id));
    return [
      ...active.map((company) => ({ id: company.id, name: company.name, inactive: false })),
      ...grandfathered.map((company) => ({ id: company.id, name: company.name, inactive: true })),
    ];
  });

  readonly executionModeOptions = computed<ExecutionModeOption[]>(() => {
    this.translationsReady();
    return EXECUTION_MODES.map((mode) => ({ label: this.translate.instant(executionModeTranslationKey(mode)), value: mode }));
  });

  /** True only once p-dialog's own open transition has actually finished (its
   * (onShow) event). A p-select created in the SAME tick as that transition ends
   * up with a ControlValueAccessor that doesn't register clicks - a real,
   * reproducible PrimeNG/CDK timing issue in this app's version (see
   * PriceListItemFormDialogComponent, which hit the same thing first). Only
   * rendering the form after onShow sidesteps it entirely. */
  readonly dialogShown = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    executionMode: ['Individual' as ServiceExecutionMode, Validators.required],
    colorHex: [DEFAULT_COLOR_NO_HASH],
    defaultDurationMinutes: [DEFAULT_DURATION_MINUTES, [Validators.required, Validators.min(1)]],
    defaultPrice: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    sortOrder: [0],
    companyIds: this.fb.nonNullable.control<string[]>([]),
  });

  constructor() {
    this.companiesService
      .getPage({ page: 1, pageSize: COMPANY_LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeCompanies.set(result.items));

    effect(() => {
      if (this.visible()) {
        this.resetForm(this.service());
      } else {
        // Reset for the next open - dialogShown flips back to true once
        // p-dialog's (onShow) fires again.
        this.dialogShown.set(false);
      }
    });
  }

  onDialogShow(): void {
    this.dialogShown.set(true);
  }

  toggleCompany(id: string): void {
    const control = this.form.controls.companyIds;
    const ids = control.value;
    control.setValue(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  }

  isCompanySelected(id: string): boolean {
    return this.form.controls.companyIds.value.includes(id);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: ServiceUpsertRequest = {
      name: raw.name,
      executionMode: raw.executionMode,
      colorHex: raw.colorHex ? `#${raw.colorHex.replace('#', '').toUpperCase()}` : null,
      defaultDurationMinutes: raw.defaultDurationMinutes,
      defaultPrice: raw.defaultPrice,
      description: raw.description || null,
      sortOrder: raw.sortOrder,
    };
    const companyIds = raw.companyIds;

    const current = this.service();
    const request$ = current
      ? this.servicesService.update(current.id, request)
      : this.servicesService.create(request);

    this.saving.set(true);
    request$.subscribe({
      // Service core data is saved (create/update both succeeded server-side)
      // before this second step ever runs - a failure here must NOT roll back
      // or delete the just-created/updated Service (backend has no such
      // rollback, see ReplaceAssignedCompanies's doc), it just leaves
      // ServiceCompany assignments as they already were.
      next: (savedService) => {
        this.servicesService
          .replaceAssignedCompanies(savedService.id, companyIds)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.notifications.showSuccess(
                this.translate.instant(current ? 'CATALOG.SERVICES.UPDATED' : 'CATALOG.SERVICES.CREATED'),
              );
              this.visible.set(false);
              this.saved.emit();
            },
            // Default error toast already surfaced the real reason (e.g.
            // INACTIVE_COMPANY) - close and refresh the list so it reflects
            // the real, now-existing/updated Service instead of silently
            // claiming the whole save succeeded.
            error: () => {
              this.visible.set(false);
              this.saved.emit();
            },
          });
      },
      error: () => this.saving.set(false),
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  selectColor(colorHex: string): void {
    this.form.controls.colorHex.setValue(colorHex);
  }

  private resetForm(service: ServiceDto | null): void {
    this.form.reset({
      name: service?.name ?? '',
      executionMode: service?.executionMode ?? 'Individual',
      colorHex: service?.colorHex ? service.colorHex.replace('#', '') : DEFAULT_COLOR_NO_HASH,
      defaultDurationMinutes: service?.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES,
      defaultPrice: service?.defaultPrice ?? 0,
      description: service?.description ?? '',
      sortOrder: service?.sortOrder ?? 0,
      companyIds: [],
    });

    this.assignedCompanies.set([]);
    if (service) {
      this.companiesLoading.set(true);
      this.servicesService
        .getAssignedCompanies(service.id)
        .pipe(finalize(() => this.companiesLoading.set(false)))
        .subscribe({
          next: (companies) => {
            this.assignedCompanies.set(companies);
            this.form.controls.companyIds.setValue(companies.map((company) => company.id));
          },
          error: () => this.assignedCompanies.set([]),
        });
    }
  }
}
