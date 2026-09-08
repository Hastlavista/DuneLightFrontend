import { Component, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CompaniesService } from '../../../../../core/services/companies.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { CompanyDto } from '../../../../../core/models/company.model';
import { DAYS_OF_WEEK, DayOfWeek } from '../../../../../core/models/group.model';
import { WorkingHoursTemplateDto } from '../../../../../core/models/working-hours.model';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { WorkingHoursTemplateService } from '../../../../../core/services/working-hours-template.service';
import { timeOfDayLabel } from '../../../../../core/utils/time-of-day.util';
import { CompanyFormDialogComponent } from './company-form-dialog.component';

const DEFAULT_PAGE_SIZE = 20;
const WEEKDAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'PON',
  Tuesday: 'UTO',
  Wednesday: 'SRI',
  Thursday: 'ČET',
  Friday: 'PET',
  Saturday: 'SUB',
  Sunday: 'NED',
};

interface CompanyDayHours {
  day: DayOfWeek;
  label: string;
  hours: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-admin-companies',
  imports: [
    TableModule,
    Button,
    RouterLink,
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
  private readonly workingHoursService = inject(WorkingHoursTemplateService);
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
  readonly workingHoursByCompany = signal<Record<string, WorkingHoursTemplateDto | null>>({});

  readonly dialogVisible = signal(false);

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
    this.dialogVisible.set(true);
  }

  companyColor(company: CompanyDto): string {
    return company.colorHex ?? 'var(--teal)';
  }

  weekHours(company: CompanyDto): CompanyDayHours[] {
    const template = this.workingHoursByCompany()[company.id];
    return DAYS_OF_WEEK.map((day) => {
      const intervals = (template?.intervals ?? [])
        .filter((interval) => interval?.dayOfWeek === day && interval.startTime && interval.endTime)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const hours = intervals.map((interval) => `${timeOfDayLabel(interval.startTime)}-${timeOfDayLabel(interval.endTime)}`).join(', ');

      return {
        day,
        label: WEEKDAY_LABELS[day],
        hours: hours || 'Zatvoreno',
        isOpen: intervals.length > 0,
      };
    });
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
        this.fetchWorkingHours(result.items);
      });
  }

  private fetchWorkingHours(companies: CompanyDto[]): void {
    if (companies.length === 0) {
      this.workingHoursByCompany.set({});
      return;
    }

    forkJoin(
      companies.map((company) =>
        this.workingHoursService.getForCompany(company.id, { suppressErrorToast: true }).pipe(catchError(() => of(null))),
      ),
    ).subscribe((templates) => {
      this.workingHoursByCompany.set(
        companies.reduce<Record<string, WorkingHoursTemplateDto | null>>((acc, company, index) => {
          acc[company.id] = templates[index];
          return acc;
        }, {}),
      );
    });
  }

}
