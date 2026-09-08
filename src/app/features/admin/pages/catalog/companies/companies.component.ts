import { Component, ViewChild, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { CompaniesService } from '../../../../../core/services/companies.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { CompanyDto } from '../../../../../core/models/company.model';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { CompanyFormDialogComponent } from './company-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-companies',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    ListToolbarComponent,
    StatusTagComponent,
    CompanyFormDialogComponent,
  ],
  templateUrl: './companies.component.html',
  styleUrl: './companies.component.scss',
})
export class CompaniesComponent {
  private readonly companiesService = inject(CompaniesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<CompanyDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly weekdays = ['PON', 'UTO', 'SRI', 'ČET', 'PET', 'SUB', 'NED'];

  readonly dialogVisible = signal(false);
  readonly editingCompany = signal<CompanyDto | null>(null);

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

  openCreate(): void {
    this.editingCompany.set(null);
    this.dialogVisible.set(true);
  }

  companyColor(company: CompanyDto): string {
    return company.colorHex ?? 'var(--teal)';
  }

  openEdit(company: CompanyDto): void {
    this.editingCompany.set(company);
    this.dialogVisible.set(true);
  }

  onSaved(): void {
    this.fetch(this.table?.first ?? 0, this.rows());
  }

  activate(company: CompanyDto): void {
    this.companiesService.activate(company.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.COMPANIES.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
      },
      error: () => {},
    });
  }

  confirmDeactivate(company: CompanyDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.COMPANIES.CONFIRM_DEACTIVATE', { name: company.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.companiesService.deactivate(company.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.COMPANIES.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(company: CompanyDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.COMPANIES.CONFIRM_DELETE', { name: company.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.companiesService.delete(company.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.COMPANIES.DELETED'));
            this.fetch(this.table?.first ?? 0, this.rows());
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.companiesService
      .getPage({
        page,
        pageSize: rows,
        search: this.search() || undefined,
        isActive: this.showInactive() ? undefined : true,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
