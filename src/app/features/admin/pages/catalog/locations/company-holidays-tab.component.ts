import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { AppError } from '../../../../../core/models/api-error.model';
import { CompanyHolidayDto } from '../../../../../core/models/company-holiday.model';
import { CompanyHolidaysService } from '../../../../../core/services/company-holidays.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { toStartOfDayIso } from '../../../../../core/utils/date.util';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';

interface YearOption {
  label: string;
  value: number;
}

/**
 * "Praznici" tab on the location form dialog (see LocationFormDialogComponent) -
 * same self-contained-per-owner shape as WorkingHoursTemplateEditorComponent,
 * but Company-only (no Employee variant) and list+create+delete+generate
 * instead of a GET/PUT singleton. `canManage` (roster.templates.manage) gates
 * every edit affordance, same grant the working-hours tab already uses - a
 * roster.templates.view-only caller still sees the list, read-only.
 */
@Component({
  selector: 'app-company-holidays-tab',
  imports: [ReactiveFormsModule, FormsModule, TableModule, Select, DatePicker, InputText, Button, Tag, TranslatePipe, HrDatePipe],
  templateUrl: './company-holidays-tab.component.html',
  styleUrl: './company-holidays-tab.component.scss',
})
export class CompanyHolidaysTabComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CompanyHolidaysService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly companyId = input.required<string>();

  readonly canManage = computed(() => this.currentEmployeeService.hasGrant('roster.templates.manage'));

  readonly year = signal(new Date().getFullYear());
  readonly yearOptions = computed<YearOption[]>(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1, current + 2].map((y) => ({ label: `${y}`, value: y }));
  });

  readonly loading = signal(false);
  readonly items = signal<CompanyHolidayDto[]>([]);

  readonly generating = signal(false);
  /** Set only on 409 HOLIDAY_CATALOG_NOT_DEFINED_FOR_COUNTRY - shown as an
   * inline hint (with a shortcut into the manual-add form) instead of just a
   * toast, per the "jasna poruka + poticaj na ručni unos" requirement. */
  readonly generateCatalogMissing = signal(false);

  readonly addFormVisible = signal(false);
  readonly addSaving = signal(false);
  readonly addForm = this.fb.nonNullable.group({
    date: this.fb.control<Date | null>(null, Validators.required),
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  constructor() {
    effect(() => this.fetch(this.companyId(), this.year()));
  }

  onYearChange(year: number): void {
    this.year.set(year);
  }

  onGenerate(): void {
    this.generateCatalogMissing.set(false);
    this.generating.set(true);
    this.service
      .generate(this.companyId(), this.year(), { suppressErrorToast: true })
      .pipe(finalize(() => this.generating.set(false)))
      .subscribe({
        next: (result) => {
          this.notifications.showSuccess(
            this.translate.instant('CATALOG.LOCATIONS.HOLIDAYS.GENERATED', {
              created: result.createdCount,
              skipped: result.skippedCount,
            }),
          );
          this.fetch(this.companyId(), this.year());
        },
        error: (err: AppError) => {
          if (err.code === 'HOLIDAY_CATALOG_NOT_DEFINED_FOR_COUNTRY') {
            this.generateCatalogMissing.set(true);
          } else {
            this.notifications.showAppError(err);
          }
        },
      });
  }

  openAddForm(): void {
    this.addForm.reset({ date: null, name: '' });
    this.addFormVisible.set(true);
  }

  onAddCancel(): void {
    this.addFormVisible.set(false);
  }

  onAddSave(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    const raw = this.addForm.getRawValue();
    this.addSaving.set(true);
    this.service
      .create(this.companyId(), { date: toStartOfDayIso(raw.date as Date), name: raw.name })
      .pipe(finalize(() => this.addSaving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('CATALOG.LOCATIONS.HOLIDAYS.CREATED'));
          this.addFormVisible.set(false);
          this.fetch(this.companyId(), this.year());
        },
        error: () => {},
      });
  }

  confirmDelete(holiday: CompanyHolidayDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.LOCATIONS.HOLIDAYS.CONFIRM_DELETE', { name: holiday.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.service.delete(this.companyId(), holiday.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.LOCATIONS.HOLIDAYS.DELETED'));
            this.fetch(this.companyId(), this.year());
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(companyId: string, year: number): void {
    this.loading.set(true);
    this.service
      .getForYear(companyId, year)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((items) => this.items.set(items));
  }
}
