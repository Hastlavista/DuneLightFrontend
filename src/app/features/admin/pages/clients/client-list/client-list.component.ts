import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { ClientTagDto } from '../../../../../core/models/client-tag.model';
import { ClientDto } from '../../../../../core/models/client.model';
import { EmployeeDto } from '../../../../../core/models/employee.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { ClientTagsService } from '../../../../../core/services/client-tags.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { AnonymizeClientDialogComponent } from './anonymize-client-dialog.component';

const DEFAULT_PAGE_SIZE = 20;
/** pageSize max is 200 - fetches the full active set in one page for the filter
 * dropdowns (same pattern as Zaposlenici/Usluge). */
const LOOKUP_PAGE_SIZE = 200;

interface FilterOption<T> {
  label: string;
  value: T | null;
}

@Component({
  selector: 'app-admin-client-list',
  imports: [
    TableModule,
    Button,
    Select,
    Menu,
    Tag,
    FormsModule,
    TranslatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    AnonymizeClientDialogComponent,
  ],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.scss',
})
export class ClientListComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly clientTagsService = inject(ClientTagsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly locationsService = inject(LocationsService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  @ViewChild('dt') private table!: Table;
  @ViewChild('rowMenu') private rowMenu!: Menu;

  readonly items = signal<ClientDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly tagFilter = signal<string | null>(null);
  readonly homeTrainerFilter = signal<string | null>(null);
  readonly homeLocationFilter = signal<string | null>(null);

  readonly activeTags = signal<ClientTagDto[]>([]);
  readonly activeEmployees = signal<EmployeeDto[]>([]);
  readonly activeLocations = signal<LocationDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly tagFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CLIENTS.FILTER_TAG_ALL'), value: null },
      ...this.activeTags().map((tag) => ({ label: tag.name, value: tag.id })),
    ];
  });

  readonly homeTrainerFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CLIENTS.FILTER_TRAINER_ALL'), value: null },
      ...this.activeEmployees().map((employee) => ({
        label: `${employee.firstName} ${employee.lastName}`,
        value: employee.id,
      })),
    ];
  });

  readonly homeLocationFilterOptions = computed<FilterOption<string>[]>(() => {
    this.translationsReady();
    return [
      { label: this.translate.instant('CLIENTS.FILTER_LOCATION_ALL'), value: null },
      ...this.activeLocations().map((location) => ({ label: location.name, value: location.id })),
    ];
  });

  readonly menuClient = signal<ClientDto | null>(null);
  readonly rowMenuItems = computed<MenuItem[]>(() => [
    {
      label: this.translate.instant('CLIENTS.ANONYMIZE'),
      icon: 'pi pi-eraser',
      command: () => {
        const client = this.menuClient();
        if (client) {
          this.openAnonymize(client);
        }
      },
    },
  ]);

  readonly anonymizeDialogVisible = signal(false);
  readonly anonymizeClient = signal<ClientDto | null>(null);

  constructor() {
    this.loadActiveTags();
    this.loadActiveEmployees();
    this.loadActiveLocations();
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

  onTagFilterChange(tagId: string | null): void {
    this.tagFilter.set(tagId);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onHomeTrainerFilterChange(trainerId: string | null): void {
    this.homeTrainerFilter.set(trainerId);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  onHomeLocationFilterChange(locationId: string | null): void {
    this.homeLocationFilter.set(locationId);
    this.table.first = 0;
    this.fetch(0, this.rows());
  }

  openCreate(): void {
    this.router.navigate(['/admin/clients/new']);
  }

  openEdit(client: ClientDto): void {
    this.router.navigate(['/admin/clients', client.id]);
  }

  openRowMenu(event: Event, client: ClientDto): void {
    this.menuClient.set(client);
    this.rowMenu.toggle(event);
  }

  openAnonymize(client: ClientDto): void {
    this.anonymizeClient.set(client);
    this.anonymizeDialogVisible.set(true);
  }

  onAnonymized(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
  }

  activate(client: ClientDto): void {
    this.clientsService.activate(client.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CLIENTS.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
      },
      error: () => {},
    });
  }

  confirmDeactivate(client: ClientDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CLIENTS.CONFIRM_DEACTIVATE', { name: this.fullName(client) }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.clientsService.deactivate(client.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CLIENTS.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(client: ClientDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CLIENTS.CONFIRM_DELETE', { name: this.fullName(client) }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.clientsService.delete(client.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CLIENTS.DELETED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  fullName(client: ClientDto): string {
    return `${client.firstName} ${client.lastName}`;
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.clientsService
      .getPage(
        {
          page,
          pageSize: rows,
          search: this.search() || undefined,
          isActive: this.showInactive() ? undefined : true,
        },
        {
          extraParams: {
            tagId: this.tagFilter(),
            homeTrainerId: this.homeTrainerFilter(),
            homeLocationId: this.homeLocationFilter(),
          },
        },
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }

  private loadActiveTags(): void {
    this.clientTagsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeTags.set(result.items));
  }

  private loadActiveEmployees(): void {
    this.employeesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeEmployees.set(result.items));
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }
}
