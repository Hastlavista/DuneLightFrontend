import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { EmployeeDto } from '../../../../../core/models/employee.model';
import { EngagementTypeDto } from '../../../../../core/models/engagement-type.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { EngagementTypesService } from '../../../../../core/services/engagement-types.service';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { ColorSwatchComponent } from '../../../../../shared/components/color-swatch/color-swatch.component';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';

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
    TableModule,
    Button,
    Select,
    FormsModule,
    TranslatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    ColorSwatchComponent,
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss',
})
export class EmployeeListComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly locationsService = inject(LocationsService);
  private readonly engagementTypesService = inject(EngagementTypesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<EmployeeDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly locationFilter = signal<string | null>(null);
  readonly engagementTypeFilter = signal<string | null>(null);

  readonly activeLocations = signal<LocationDto[]>([]);
  readonly activeEngagementTypes = signal<EngagementTypeDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly locationFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('EMPLOYEES.FILTER_LOCATION_ALL'), value: null },
      ...this.activeLocations().map((location) => ({ label: location.name, value: location.id })),
    ];
  });

  readonly engagementTypeFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('EMPLOYEES.FILTER_ENGAGEMENT_TYPE_ALL'), value: null },
      ...this.activeEngagementTypes().map((type) => ({ label: type.name, value: type.id })),
    ];
  });

  constructor() {
    this.loadActiveLocations();
    this.loadActiveEngagementTypes();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.rows.set(rows);
    this.fetch(first, rows);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onShowInactiveChange(value: boolean): void {
    this.showInactive.set(value);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onLocationFilterChange(locationId: string | null): void {
    this.locationFilter.set(locationId);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onEngagementTypeFilterChange(engagementTypeId: string | null): void {
    this.engagementTypeFilter.set(engagementTypeId);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  openCreate(): void {
    this.router.navigate(['/admin/employees/new']);
  }

  openEdit(employee: EmployeeDto): void {
    this.router.navigate(['/admin/employees', employee.id]);
  }

  activate(employee: EmployeeDto): void {
    this.employeesService.activate(employee.id).subscribe({
      next: (result) => {
        this.notifications.showSuccess(this.translate.instant('EMPLOYEES.ACTIVATED'));
        if (result.warning) {
          this.notifications.showWarning(result.warning);
        }
        this.fetch(this.table?.first ?? 0, this.rows());
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
              this.notifications.showWarning(result.warning);
            }
            this.fetch(this.table?.first ?? 0, this.rows());
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
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  fullName(employee: EmployeeDto): string {
    return `${employee.firstName} ${employee.lastName}`;
  }

  /** Only ever true for the org's Owner viewing their own row (see
   * CurrentEmployeeService.isOwner) - EmployeeDto doesn't carry IsOwner for
   * every row, so this can't identify the Owner in anyone else's rows/when
   * viewed by a non-Owner. */
  isOwnerRow(employee: EmployeeDto): boolean {
    return this.currentEmployeeService.isOwner() && employee.id === this.currentEmployeeService.employee()?.employeeId;
  }

  /** "Uloga" column: Owner badge for the one row that can be identified as
   * such (see isOwnerRow), else Role (business tag) names if any, else
   * GrantGroup names, else a dash. Priority matches how meaningful each is to
   * a viewer scanning the list - Role is a deliberately-chosen business label,
   * GrantGroup names are more technical/permission-shaped. */
  roleColumnLabel(employee: EmployeeDto): string {
    if (this.isOwnerRow(employee)) {
      return this.translate.instant('EMPLOYEES.OWNER_BADGE');
    }
    if (employee.roleNames.length > 0) {
      return employee.roleNames.join(', ');
    }
    if (employee.grantGroupNames.length > 0) {
      return employee.grantGroupNames.join(', ');
    }
    return '—';
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
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
            companyId: this.locationFilter(),
            engagementTypeId: this.engagementTypeFilter(),
          },
        },
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }

  private loadActiveEngagementTypes(): void {
    this.engagementTypesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeEngagementTypes.set(result.items));
  }
}
