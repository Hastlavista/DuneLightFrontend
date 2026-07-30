import { Injectable, inject, signal } from '@angular/core';
import { PackageDto } from '../models/package.model';
import { PackagesService } from './packages.service';

const ACTIVE_PACKAGE_FETCH_PAGE_SIZE = 200;

/**
 * Single shared source of the active package list, so Cjenik's price-list-item
 * form stays in sync with Paketi (create/edit/activate/deactivate/delete)
 * without its own fetch going stale. Paketi calls refresh() after any mutation;
 * everyone else just reads packages().
 */
@Injectable({ providedIn: 'root' })
export class ActivePackagesStore {
  private readonly packagesService = inject(PackagesService);

  readonly packages = signal<PackageDto[]>([]);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.packagesService
      .getPage(
        { page: 1, pageSize: ACTIVE_PACKAGE_FETCH_PAGE_SIZE, isActive: true },
        { suppressErrorToast: true },
      )
      .subscribe((result) => this.packages.set(result.items));
  }
}
