import { Injectable, inject, signal } from '@angular/core';
import { ServiceDto } from '../models/service.model';
import { ServicesService } from './services.service';

const ACTIVE_SERVICE_FETCH_PAGE_SIZE = 200;

/**
 * Single shared source of the active service list, so every screen that reads
 * it (Cjenik's price-list-item form, Paketi's package form, ...) and the one
 * screen that mutates it (Usluge) stay in sync without each needing its own
 * fetch. Usluge calls refresh() after any create/update/activate/deactivate/
 * delete; everyone else just reads services().
 */
@Injectable({ providedIn: 'root' })
export class ActiveServicesStore {
  private readonly servicesService = inject(ServicesService);

  readonly services = signal<ServiceDto[]>([]);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.servicesService
      .getPage(
        { page: 1, pageSize: ACTIVE_SERVICE_FETCH_PAGE_SIZE, isActive: true },
        { suppressErrorToast: true },
      )
      .subscribe((result) => this.services.set(result.items));
  }
}
