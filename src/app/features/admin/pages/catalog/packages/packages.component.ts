import { Component, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { entryModeTranslationKey, PackageDto } from '../../../../../core/models/package.model';
import { ActivePackagesStore } from '../../../../../core/services/active-packages.store';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PackagesService } from '../../../../../core/services/packages.service';
import { ListToolbarComponent } from '../../../../../shared/components/list-toolbar/list-toolbar.component';
import { StatusTagComponent } from '../../../../../shared/components/status-tag/status-tag.component';
import { EurCurrencyPipe } from '../../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-packages',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    EurCurrencyPipe,
    HrDatePipe,
    ListToolbarComponent,
    StatusTagComponent,
  ],
  templateUrl: './packages.component.html',
  styleUrl: './packages.component.scss',
})
export class PackagesComponent {
  private readonly packagesService = inject(PackagesService);
  private readonly activePackagesStore = inject(ActivePackagesStore);
  private readonly notifications = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  @ViewChild('dt') private table!: Table;

  readonly items = signal<PackageDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly showInactive = signal(false);

  readonly entryModeTranslationKey = entryModeTranslationKey;

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
    this.router.navigate(['/admin/services/packages/new']);
  }

  openEdit(pkg: PackageDto): void {
    this.router.navigate(['/admin/services/packages', pkg.id]);
  }

  activate(pkg: PackageDto): void {
    this.packagesService.activate(pkg.id).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant('CATALOG.PACKAGES.ACTIVATED'));
        this.fetch(this.table?.first ?? 0, this.rows());
        this.activePackagesStore.refresh();
      },
      error: () => {},
    });
  }

  confirmDeactivate(pkg: PackageDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.PACKAGES.CONFIRM_DEACTIVATE', { name: pkg.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => {
        this.packagesService.deactivate(pkg.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.PACKAGES.DEACTIVATED'));
            this.fetch(this.table?.first ?? 0, this.rows());
            this.activePackagesStore.refresh();
          },
          error: () => {},
        });
      },
    });
  }

  confirmDelete(pkg: PackageDto): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('CATALOG.PACKAGES.CONFIRM_DELETE', { name: pkg.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.packagesService.delete(pkg.id).subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('CATALOG.PACKAGES.DELETED'));
            this.fetch(this.table?.first ?? 0, this.rows());
            this.activePackagesStore.refresh();
          },
          error: () => {},
        });
      },
    });
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.packagesService
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
