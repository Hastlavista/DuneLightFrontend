import { Component, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import {
  ClientPackageDto,
  ClientPackageServiceEntryDto,
  clientPackageStatusSeverity,
  clientPackageStatusTranslationKey,
} from '../../../../../core/models/client-package.model';
import { ClientPackagesService } from '../../../../../core/services/client-packages.service';
import { EurCurrencyPipe } from '../../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../../shared/pipes/hr-date.pipe';
import { IssuePackageDialogComponent } from './issue-package-dialog.component';

/** Packages sold to this client - a tab on the client detail page (edit mode
 * only, see ClientFormComponent), not a separate route. Read from
 * GET /api/clients/{clientId}/packages, a flat array (not paged). */
@Component({
  selector: 'app-client-packages-tab',
  imports: [TableModule, Button, Tag, TranslatePipe, EurCurrencyPipe, HrDatePipe, IssuePackageDialogComponent],
  templateUrl: './client-packages-tab.component.html',
  styleUrl: './client-packages-tab.component.scss',
})
export class ClientPackagesTabComponent {
  private readonly clientPackagesService = inject(ClientPackagesService);
  private readonly translate = inject(TranslateService);

  readonly clientId = input.required<string>();

  readonly items = signal<ClientPackageDto[]>([]);
  readonly loading = signal(false);
  readonly issueDialogVisible = signal(false);

  readonly clientPackageStatusTranslationKey = clientPackageStatusTranslationKey;
  readonly clientPackageStatusSeverity = clientPackageStatusSeverity;

  constructor() {
    effect(() => this.fetch(this.clientId()));
  }

  openIssueDialog(): void {
    this.issueDialogVisible.set(true);
  }

  onIssued(): void {
    this.fetch(this.clientId());
  }

  /** SharedPool: "remaining / total" (or "unlimited" when totalEntryCount is
   * null). PerService: irrelevant here - see serviceEntries in the template instead. */
  sharedPoolLabel(pkg: ClientPackageDto): string {
    if (pkg.totalEntryCount == null) {
      return this.translate.instant('CLIENTS.PACKAGES.UNLIMITED');
    }
    return `${pkg.remainingSharedEntries} / ${pkg.totalEntryCount}`;
  }

  /** "remaining / total" for one PerService entry, or "unlimited" when that
   * service's allowance has no cap (remainingEntries/totalEntries null). */
  serviceEntryLabel(entry: ClientPackageServiceEntryDto): string {
    if (entry.remainingEntries == null) {
      return this.translate.instant('CLIENTS.PACKAGES.UNLIMITED');
    }
    return `${entry.remainingEntries} / ${entry.totalEntries}`;
  }

  private fetch(clientId: string): void {
    this.loading.set(true);
    this.clientPackagesService
      .getForClient(clientId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((items) => this.items.set(items));
  }
}
