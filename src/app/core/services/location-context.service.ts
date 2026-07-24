import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { StudioLocation, toStudioLocation } from '../models/location.model';
import { LocationsService } from './locations.service';

const SELECTED_LOCATION_KEY = 'dl_selected_location';

/** pageSize max is 200 (API limit) - comfortably above any realistic location count,
 * used here to fetch the full active set in one page for the global switcher. */
const SWITCHER_PAGE_SIZE = 200;

/**
 * Global location selection. Either "All locations" (null) or one specific location.
 * Future screens (schedule, finance, clients...) just subscribe to selectedLocation.
 */
@Injectable({ providedIn: 'root' })
export class LocationContextService {
  private readonly locationsService = inject(LocationsService);

  private readonly locationsState = signal<StudioLocation[]>([]);
  private readonly selectedIdState = signal<string | null>(this.readStoredSelection());

  readonly locations = this.locationsState.asReadonly();
  readonly selectedLocationId = this.selectedIdState.asReadonly();
  readonly selectedLocation = computed<StudioLocation | null>(() => {
    const id = this.selectedIdState();
    return id ? (this.locationsState().find((location) => location.id === id) ?? null) : null;
  });

  loadLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: SWITCHER_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .pipe(
        map((page) => page.items.map(toStudioLocation)),
        catchError(() => of<StudioLocation[]>([])),
      )
      .subscribe((locations) => {
        this.locationsState.set(locations);

        const currentId = this.selectedIdState();
        if (currentId && !locations.some((location) => location.id === currentId)) {
          this.selectLocation(null);
        }
      });
  }

  selectLocation(locationId: string | null): void {
    this.selectedIdState.set(locationId);
    if (locationId) {
      localStorage.setItem(SELECTED_LOCATION_KEY, locationId);
    } else {
      localStorage.removeItem(SELECTED_LOCATION_KEY);
    }
  }

  private readStoredSelection(): string | null {
    return localStorage.getItem(SELECTED_LOCATION_KEY);
  }
}
