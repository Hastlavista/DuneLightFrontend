import { Injectable, inject, signal } from '@angular/core';
import { ServiceCategoryDto } from '../models/service-category.model';
import { ServiceCategoriesService } from './service-categories.service';

const ACTIVE_CATEGORY_FETCH_PAGE_SIZE = 200;

/**
 * Single shared source of the active service-category list, so every screen
 * that reads it (Usluge's filter/create dialog, Cjenik, Paketi, ...) and the
 * one screen that mutates it (Kategorije) stay in sync without each needing
 * its own fetch. Kategorije calls refresh() after any create/update/activate/
 * deactivate/delete; everyone else just reads categories().
 */
@Injectable({ providedIn: 'root' })
export class ActiveServiceCategoriesStore {
  private readonly categoriesService = inject(ServiceCategoriesService);

  readonly categories = signal<ServiceCategoryDto[]>([]);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.categoriesService
      .getPage(
        { page: 1, pageSize: ACTIVE_CATEGORY_FETCH_PAGE_SIZE, isActive: true },
        { suppressErrorToast: true },
      )
      .subscribe((result) => this.categories.set(result.items));
  }
}
