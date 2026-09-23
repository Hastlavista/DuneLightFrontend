import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { finalize } from 'rxjs';
import { EmployeeDto } from '../../../../../core/models/employee.model';
import { EngagementTypeDto } from '../../../../../core/models/engagement-type.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { EngagementTypesService } from '../../../../../core/services/engagement-types.service';
import { CompanyContextService } from '../../../../../core/services/company-context.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { resolveWarningMessage } from '../../../../../core/utils/warning-translation.util';

const DEFAULT_PAGE_SIZE = 20;
/** pageSize max is 200 - fetches the full active set in one page for the filter
 * dropdowns (same pattern as Usluge's category filter). */
const LOOKUP_PAGE_SIZE = 200;

interface FilterOption<T> {
  label: string;
  value: T | null;
}

@Component({
  selector: 'app-admin-employee-list',
  imports: [
    Button,
    Paginator,
    Select,
    FormsModule,
    TranslatePipe,
    ListToolbarComponent,
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss',
})
export class EmployeeListComponent {
  private readonly employeesService = inject(EmployeesService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly engagementTypesService = inject(EngagementTypesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly items = signal<EmployeeDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly failed = signal(false);
  // Latest-request-wins guard for page/search/filter changes.
  private fetchToken = 0;
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly first = signal(0);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly companyFilter = signal<string | null>(null);
  readonly engagementTypeFilter = signal<string | null>(null);

  readonly activeCompanies = this.companyContext.companies;
  readonly activeEngagementTypes = signal<EngagementTypeDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly companyFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('EMPLOYEES.FILTER_COMPANY_ALL'), value: null },
      ...this.activeCompanies().map((company) => ({ label: company.name, value: company.id })),
    ];
  });

  readonly engagementTypeFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('EMPLOYEES.FILTER_ENGAGEMENT_TYPE_ALL'), value: null },
      ...this.activeEngagementTypes().map((type) => ({ label: type.name, value: type.id })),
    ];
  });

  /** GET /api/employees requires employees.view - employees.manage alone (a
   * custom GrantGroup) does not imply it, per EmployeesController.GetPaged.
   * Skip the call entirely rather than firing a request the current grants
   * can't pass: without this, a manage-only viewer got a 403 that the
   * template's items().length===0 branch silently rendered as "no employees
   * found", indistinguishable from a genuinely empty org (see
   * EMPLOYEES.NO_LIST_PERMISSION for the distinct message instead). */
  readonly canViewList = computed(() => this.currentEmployeeService.hasGrant('employees.view'));

  constructor() {
    if (this.canViewList()) {
      this.loadActiveCompanies();
      this.loadActiveEngagementTypes();
      this.fetch(0, this.rows());
    }
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.resetAndFetch();
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.resetAndFetch();
  }

  onCompanyFilterChange(companyId: string | null): void {
    this.companyFilter.set(companyId);
    this.resetAndFetch();
  }

  onEngagementTypeFilterChange(engagementTypeId: string | null): void {
    this.engagementTypeFilter.set(engagementTypeId);
    this.resetAndFetch();
  }

  onPageChange(event: PaginatorState): void {
    const rows = event.rows ?? this.rows();
    const first = event.first ?? 0;
    this.rows.set(rows);
    this.first.set(first);
    this.fetch(first, rows);
  }

  openCreate(): void {
    this.router.navigate(['/app/employees/new']);
  }

  openEdit(employee: EmployeeDto): void {
    this.router.navigate(['/app/employees', employee.id]);
  }

  /** Shortcut to the "Povijest" tab on the employee profile - same
   * destination as openEdit(), just with `?tab=history` so
   * EmployeeFormComponent opens straight into it instead of "Podaci" (same
   * pattern intent as Klijenti's "Povijest klijenta" list shortcut, adapted
   * to a query param since the employee profile is a full tabbed page, not a
   * modal). */
  openHistory(employee: EmployeeDto): void {
    this.router.navigate(['/app/employees', employee.id], { queryParams: { tab: 'history' } });
  }

  activate(employee: EmployeeDto): void {
    this.employeesService.activate(employee.id).subscribe({
      next: (result) => {
        this.notifications.showSuccess(this.translate.instant('EMPLOYEES.ACTIVATED'));
        if (result.warning) {
          this.notifications.showWarning(resolveWarningMessage(this.translate, result.warning));
        }
        this.resetAndFetch();
      },
      error: () => {},
    });
  }

  confirmDeactivate(employee: EmployeeDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('EMPLOYEES.CONFIRM_DEACTIVATE', { name: this.fullName(employee) }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.employeesService.deactivate(employee.id).subscribe({
          next: (result) => {
            this.notifications.showSuccess(this.translate.instant('EMPLOYEES.DEACTIVATED'));
            if (result.warning) {
              this.notifications.showWarning(resolveWarningMessage(this.translate, result.warning));
            }
            this.resetAndFetch();
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(employee: EmployeeDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('EMPLOYEES.CONFIRM_DELETE', { name: this.fullName(employee) }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.employeesService.delete(employee.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('EMPLOYEES.DELETED'));
            this.resetAndFetch();
          },
          error: () => {},
        });
      },
    });
  }

  fullName(employee: EmployeeDto): string {
    return `${employee.firstName} ${employee.lastName}`;
  }

  initials(employee: EmployeeDto): string {
    return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  }

  /** "Uloga" column: Role (business tag) names if any, else GrantGroup names,
   * else a dash. Residual IsOwner Removal - no special-cased Owner badge any
   * more; the organization's founder is just another row, shown the same way
   * as everyone else. Priority matches how meaningful each is to a viewer
   * scanning the list - Role is a deliberately-chosen business label,
   * GrantGroup names are more technical/permission-shaped. */
  roleColumnLabel(employee: EmployeeDto): string {
    if (employee.roleNames.length > 0) {
      return employee.roleNames.join(', ');
    }
    if (employee.grantGroupNames.length > 0) {
      return employee.grantGroupNames.join(', ');
    }
    return '—';
  }

  private fetch(first: number, rows: number): void {
    const token = ++this.fetchToken;
    this.loading.set(true);
    this.failed.set(false);
    const page = Math.floor(first / rows) + 1;
    this.employeesService
      .getPage(
        {
          page,
          pageSize: rows,
          search: this.search() || undefined,
          isActive: this.showInactive() ? undefined : true,
        },
        {
          extraParams: {
            companyId: this.companyFilter(),
            engagementTypeId: this.engagementTypeFilter(),
          },
        },
      )
      .pipe(
        finalize(() => {
          if (token === this.fetchToken) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (result) => {
          if (token !== this.fetchToken) {
            return;
          }
          // The last row of the last page was deleted/deactivated: show the
          // last page that still has rows instead of an empty page.
          const lastFirst = result.totalCount > 0 ? Math.floor((result.totalCount - 1) / rows) * rows : 0;
          if (result.items.length === 0 && lastFirst < first) {
            this.first.set(lastFirst);
            this.fetch(lastFirst, rows);
            return;
          }
          this.items.set(result.items);
          this.totalCount.set(result.totalCount);
        },
        // Never show a failed load as "no results", nor keep the previous filter's rows.
        error: () => {
          if (token !== this.fetchToken) {
            return;
          }
          this.items.set([]);
          this.totalCount.set(0);
          this.failed.set(true);
        },
      });
  }

  private resetAndFetch(): void {
    this.first.set(0);
    this.fetch(0, this.rows());
  }

  private loadActiveCompanies(): void {
    if (!this.companyContext.companies().length) {
      this.companyContext.loadCompanies();
    }
  }

  private loadActiveEngagementTypes(): void {
    this.engagementTypesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeEngagementTypes.set(result.items));
  }
}
