import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { AuthService } from '../../core/auth/auth.service';
import { LocationContextService } from '../../core/services/location-context.service';

interface LocationOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, RouterLinkActive, FormsModule, Select, TranslatePipe],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly locationContextService = inject(LocationContextService);
  private readonly translate = inject(TranslateService);

  readonly section = input.required<'admin' | 'trainer'>();
  readonly titleKey = input<string | null>(null);
  readonly menuToggle = output<void>();

  readonly isAdmin = computed(() => this.authService.currentRole() === 'Admin');

  readonly locationOptions = computed<LocationOption[]>(() => [
    { label: this.translate.instant('LAYOUT.TOPBAR.ALL_LOCATIONS'), value: null },
    ...this.locationContextService
      .locations()
      .map((location) => ({ label: location.name, value: location.id })),
  ]);

  readonly selectedLocationId = this.locationContextService.selectedLocationId;

  onLocationChange(locationId: string | null): void {
    this.locationContextService.selectLocation(locationId);
  }
}
