import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ClientPackageDto, remainingEntriesForService } from '../../../core/models/client-package.model';
import { translationReadySignal } from '../../../core/utils/translation-signal.util';

interface PackageOption {
  id: string;
  label: string;
}

/**
 * The ">1 eligible package" picker shown when a client has more than one
 * package that could cover a visit - GET .../packages/eligible already
 * resolved and sorted the list; the 0/1/>1 decision (skip this component
 * entirely vs. auto-select vs. require a pick) is the caller's job, this only
 * renders the choice once there's more than one. Shared between Grupe's
 * attendance modal and individual termini's (once built), so the
 * "remaining / neograničeno" label rule lives in exactly one place
 * (remainingEntriesForService).
 */
@Component({
  selector: 'app-eligible-package-select',
  imports: [Select, TranslatePipe],
  templateUrl: './eligible-package-select.component.html',
})
export class EligiblePackageSelectComponent {
  private readonly translate = inject(TranslateService);

  readonly packages = input.required<ClientPackageDto[]>();
  readonly serviceId = input.required<string>();
  readonly packageSelected = output<string>();

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly options = computed<PackageOption[]>(() => {
    this.translationsReady();
    const serviceId = this.serviceId();
    return this.packages().map((pkg) => {
      const remaining = remainingEntriesForService(pkg, serviceId);
      const remainingLabel = remaining == null ? this.translate.instant('CLIENTS.PACKAGES.UNLIMITED') : `${remaining}`;
      return { id: pkg.id, label: `${pkg.packageName} (${remainingLabel})` };
    });
  });

  onChange(packageId: string): void {
    this.packageSelected.emit(packageId);
  }
}
