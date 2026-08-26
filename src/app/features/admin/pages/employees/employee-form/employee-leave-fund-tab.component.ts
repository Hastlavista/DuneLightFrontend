import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { AppError } from '../../../../../core/models/api-error.model';
import {
  DAYS_OF_MONTH,
  EmployeeLeaveSettingsDto,
  LeaveFundDto,
  MONTHS,
  monthTranslationKey,
} from '../../../../../core/models/leave-fund.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { LeaveFundService } from '../../../../../core/services/leave-fund.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';

interface SelectOption {
  label: string;
  value: number;
}

/**
 * "Godišnji odmor" tab of the Employee form (frontend #18) - settings
 * (annualDays + a repeating renewal month/day + a repeating carryover-expiry
 * month/day, see EmployeeLeaveSettingsDto) plus a read-only view of every
 * currently relevant LeaveFund row. `canManage`
 * (roster.leave-fund.settings.manage) gates the save button/field editability
 * - a settings.view-only caller still sees the form, just disabled, same
 * convention as WorkingHoursTemplateEditorComponent's canManage. Fund rows
 * are gated separately by `canViewFunds` (roster.leave-fund.view.own/.all) -
 * a settings-only grant holder (e.g. HR admin without fund visibility) simply
 * doesn't see that section.
 *
 * A missing settings row (404 or LEAVE_SETTINGS_NOT_CONFIGURED on GET) is an
 * expected, quiet case for a brand-new employee - rendered as an empty form
 * ready to fill in, not an error (see applySettings), with a hint explaining
 * that Godišnji entries can't be recorded until this is saved once.
 */
@Component({
  selector: 'app-employee-leave-fund-tab',
  imports: [ReactiveFormsModule, InputNumber, Select, Button, Tag, TranslatePipe, HrDatePipe],
  templateUrl: './employee-leave-fund-tab.component.html',
  styleUrl: './employee-leave-fund-tab.component.scss',
})
export class EmployeeLeaveFundTabComponent {
  private readonly fb = inject(FormBuilder);
  private readonly leaveFundService = inject(LeaveFundService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly employeeId = input.required<string>();

  /** Lets the "new employee" wizard (EmployeeFormComponent) relabel the save
   * button ("Spremi i završi") without this component knowing anything about
   * wizards - defaults to the normal standalone-tab label. */
  readonly saveLabelKey = input<string>('COMMON.SAVE');

  /** Fires after a successful settings save - the wizard host uses this to
   * advance past the last step; a normal edit-mode host can just ignore it. */
  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly settingsExist = signal(false);
  readonly funds = signal<LeaveFundDto[]>([]);

  readonly canManage = computed(() => this.currentEmployeeService.hasGrant('roster.leave-fund.settings.manage'));
  readonly canViewFunds = computed(() =>
    this.currentEmployeeService.hasAnyGrant(['roster.leave-fund.view.own', 'roster.leave-fund.view.all']),
  );

  /** Newest fund year first - the current fund; any further row is a
   * not-yet-expired carryover from a previous year (see this component's
   * doc). */
  readonly sortedFunds = computed(() => [...this.funds()].sort((a, b) => b.fundYear - a.fundYear));

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly monthOptions = computed<SelectOption[]>(() => {
    this.translationsReady();
    return MONTHS.map((month) => ({ label: this.translate.instant(monthTranslationKey(month)), value: month }));
  });

  readonly dayOptions: SelectOption[] = DAYS_OF_MONTH.map((day) => ({ label: String(day), value: day }));

  readonly form = this.fb.nonNullable.group({
    annualDays: this.fb.nonNullable.control<number>(20, [Validators.required, Validators.min(0)]),
    renewalMonth: this.fb.nonNullable.control<number>(1, Validators.required),
    renewalDay: this.fb.nonNullable.control<number>(1, Validators.required),
    carryoverExpiryMonth: this.fb.nonNullable.control<number>(6, Validators.required),
    carryoverExpiryDay: this.fb.nonNullable.control<number>(30, Validators.required),
  });

  constructor() {
    effect(() => this.load(this.employeeId()));
  }

  isCurrentFund(fund: LeaveFundDto): boolean {
    return fund.fundYear === this.sortedFunds()[0]?.fundYear;
  }

  onSave(): void {
    if (!this.canManage() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request: EmployeeLeaveSettingsDto = this.form.getRawValue();
    this.saving.set(true);
    this.leaveFundService
      .updateSettings(this.employeeId(), request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (dto) => {
          this.applySettings(dto);
          this.notifications.showSuccess(this.translate.instant('EMPLOYEES.LEAVE_FUND.SAVED'));
          this.loadFunds(this.employeeId());
          this.saved.emit();
        },
        error: () => {},
      });
  }

  private load(employeeId: string): void {
    this.loading.set(true);
    this.leaveFundService.getSettings(employeeId, { suppressErrorToast: true }).subscribe({
      next: (dto) => {
        this.applySettings(dto);
        this.loading.set(false);
      },
      error: (err: AppError) => {
        this.loading.set(false);
        this.notifications.showAppError(err);
      },
    });
    this.loadFunds(employeeId);
  }

  private loadFunds(employeeId: string): void {
    if (!this.canViewFunds()) {
      return;
    }
    this.leaveFundService.getFunds(employeeId, { suppressErrorToast: true }).subscribe({
      next: (funds) => this.funds.set(funds),
      error: (err: AppError) => this.notifications.showAppError(err),
    });
  }

  private applySettings(dto: EmployeeLeaveSettingsDto | null): void {
    this.settingsExist.set(dto !== null);
    this.form.reset({
      annualDays: dto?.annualDays ?? 20,
      renewalMonth: dto?.renewalMonth ?? 1,
      renewalDay: dto?.renewalDay ?? 1,
      carryoverExpiryMonth: dto?.carryoverExpiryMonth ?? 6,
      carryoverExpiryDay: dto?.carryoverExpiryDay ?? 30,
    });

    if (this.canManage()) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
  }
}
